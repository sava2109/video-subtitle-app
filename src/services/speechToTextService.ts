import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import OpenAI from 'openai';
import { config } from '../config';
import { TranscriptionResult, TranscriptionSegment } from '../types';

const execPromise = promisify(exec);

export interface TranscriptionOptions {
  noiseReduction?: boolean;      // Ukloni pozadinsku buku
  noiseReductionLevel?: number;  // 0-100, default 21
  minSilenceLen?: number;        // Minimalna dužina tišine za razdvajanje (ms)
  silenceThresh?: number;        // Prag tišine u dB (negativna vrednost)
  highpassFilter?: number;       // Highpass filter frekvencija (Hz) - uklanja bas/buku
  lowpassFilter?: number;        // Lowpass filter (Hz) - uklanja šuštanje
}

export class SpeechToTextService {
  private openai: OpenAI | null = null;
  private ffmpegPath: string;

  constructor() {
    if (config.openaiApiKey) {
      this.openai = new OpenAI({ apiKey: config.openaiApiKey });
    }
    // Use system ffmpeg in production (Render has it), ffmpeg-static locally
    if (process.env.NODE_ENV === 'production') {
      this.ffmpegPath = 'ffmpeg';
    } else {
      this.ffmpegPath = require('ffmpeg-static');
    }
  }

  /**
   * Transcribe video to text with timestamps
   */
  async transcribe(videoPath: string, options: TranscriptionOptions = {}): Promise<TranscriptionResult> {
    // Default options - noise reduction enabled
    const opts: TranscriptionOptions = {
      noiseReduction: true,
      noiseReductionLevel: 21,
      highpassFilter: 200,   // Uklanja niske frekvencije (bas, buku AC-a, itd)
      lowpassFilter: 3000,   // Fokus na ljudski glas (obično 300-3000 Hz)
      ...options
    };

    // Extract and clean audio from video
    const audioPath = await this.extractAndCleanAudio(videoPath, opts);

    try {
      if (this.openai) {
        return await this.transcribeWithWhisperAPI(audioPath);
      } else {
        // Fallback: demo mode with sample data
        return this.getDemoTranscription();
      }
    } finally {
      // Cleanup temp audio file
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    }
  }

  /**
   * Extract audio from video with noise reduction using FFmpeg
   */
  private async extractAndCleanAudio(videoPath: string, options: TranscriptionOptions): Promise<string> {
    const audioPath = videoPath.replace(/\.[^/.]+$/, '_clean.mp3');
    
    // Build audio filters
    const filters: string[] = [];
    
    if (options.noiseReduction) {
      // Noise reduction filter (afftdn)
      // VAŽNO: nf mora biti između -80 i -20
      let nfValue = options.noiseReductionLevel || 21;
      nfValue = Math.max(20, Math.min(80, nfValue)); // Clamp to valid range
      filters.push(`afftdn=nf=-${nfValue}`);
    }
    
    if (options.highpassFilter) {
      // Highpass filter - removes low frequency noise (AC hum, traffic, etc)
      filters.push(`highpass=f=${options.highpassFilter}`);
    }
    
    if (options.lowpassFilter) {
      // Lowpass filter - focuses on voice frequencies
      filters.push(`lowpass=f=${options.lowpassFilter}`);
    }
    
    // Add volume normalization
    filters.push('loudnorm=I=-16:TP=-1.5:LRA=11');
    
    // Add silence removal - removes very quiet parts
    // silenceremove: removes silence from beginning/end
    // Could also use: filters.push('silenceremove=start_periods=1:start_silence=0.5:start_threshold=-50dB');
    
    const filterString = filters.length > 0 ? `-af "${filters.join(',')}"` : '';
    
    const command = `"${this.ffmpegPath}" -i "${videoPath}" -vn ${filterString} -acodec libmp3lame -ar 16000 -ac 1 -y "${audioPath}"`;
    
    console.log('🎤 Audio extraction command:', command);
    
    await execPromise(command);
    return audioPath;
  }

  /**
   * Transcribe using OpenAI Whisper API with word-level timestamps
   */
  private async transcribeWithWhisperAPI(audioPath: string): Promise<TranscriptionResult> {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured');
    }

    const audioFile = fs.createReadStream(audioPath);

    // Use verbose_json with WORD-level timestamps for precise timing
    const response = await this.openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'sr', // Serbian
      response_format: 'verbose_json',
      timestamp_granularities: ['word', 'segment'],
    });

    console.log('📝 Whisper response received');
    
    // Try to use word-level timestamps for more precise segmentation
    const words = (response as any).words as Array<{word: string, start: number, end: number}> | undefined;
    
    let segments: TranscriptionSegment[] = [];
    
    if (words && words.length > 0) {
      console.log(`🔤 Using word-level timestamps (${words.length} words)`);
      segments = this.createSegmentsFromWords(words);
    } else {
      // Fallback to segment-level
      console.log('📄 Using segment-level timestamps');
      segments = (response as any).segments?.map((seg: any) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      })) || [];
    }

    // If no segments, create from full text
    if (segments.length === 0 && response.text) {
      segments.push({
        start: 0,
        end: (response as any).duration || 10,
        text: response.text.trim(),
      });
    }

    console.log(`✅ Created ${segments.length} segments`);

    return {
      segments,
      language: 'sr',
      duration: (response as any).duration || 0,
    };
  }

  /**
   * Create subtitle segments from word-level timestamps
   * Groups words into natural segments with precise timing
   */
  private createSegmentsFromWords(
    words: Array<{word: string, start: number, end: number}>
  ): TranscriptionSegment[] {
    const segments: TranscriptionSegment[] = [];
    
    const MAX_WORDS_PER_SEGMENT = 8;  // Max words per subtitle
    const MAX_DURATION = 4.0;          // Max 4 seconds per subtitle
    const MIN_DURATION = 1.0;          // Min 1 second per subtitle
    const PAUSE_THRESHOLD = 0.7;       // If pause > 0.7s, start new segment
    
    let currentWords: string[] = [];
    let segmentStart = words[0]?.start || 0;
    let lastWordEnd = segmentStart;
    
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const pauseBeforeWord = word.start - lastWordEnd;
      const currentDuration = word.end - segmentStart;
      
      // Check if we should start a new segment
      const shouldSplit = 
        currentWords.length >= MAX_WORDS_PER_SEGMENT ||
        currentDuration > MAX_DURATION ||
        (pauseBeforeWord > PAUSE_THRESHOLD && currentWords.length > 0) ||
        this.endsWithPunctuation(currentWords[currentWords.length - 1]);
      
      if (shouldSplit && currentWords.length > 0) {
        // Save current segment
        segments.push({
          start: segmentStart,
          end: lastWordEnd,
          text: currentWords.join(' ').trim(),
        });
        
        // Start new segment
        currentWords = [];
        segmentStart = word.start;
      }
      
      currentWords.push(word.word.trim());
      lastWordEnd = word.end;
    }
    
    // Add remaining words as last segment
    if (currentWords.length > 0) {
      segments.push({
        start: segmentStart,
        end: lastWordEnd,
        text: currentWords.join(' ').trim(),
      });
    }
    
    // Ensure minimum duration for each segment
    return segments.map((seg, index) => {
      let duration = seg.end - seg.start;
      if (duration < MIN_DURATION) {
        // Extend end time, but don't overlap with next segment
        const maxEnd = index < segments.length - 1 
          ? segments[index + 1].start - 0.1 
          : seg.end + (MIN_DURATION - duration);
        seg.end = Math.min(seg.start + MIN_DURATION, maxEnd);
      }
      return seg;
    });
  }

  /**
   * Check if word ends with sentence punctuation
   */
  private endsWithPunctuation(word: string | undefined): boolean {
    if (!word) return false;
    return /[.!?;:,]$/.test(word);
  }

  /**
   * Demo transcription for testing without API key
   */
  private getDemoTranscription(): TranscriptionResult {
    return {
      segments: [
        { start: 0, end: 3, text: 'Dobrodošli u našu aplikaciju.' },
        { start: 3, end: 6, text: 'Ovo je test titlova na srpskom jeziku.' },
        { start: 6, end: 10, text: 'Aplikacija automatski konvertuje latinicu u ćirilicu.' },
        { start: 10, end: 14, text: 'Možete editovati titlove i exportovati video.' },
        { start: 14, end: 18, text: 'Hvala što koristite našu aplikaciju!' },
      ],
      language: 'sr',
      duration: 18,
    };
  }
}

export default SpeechToTextService;