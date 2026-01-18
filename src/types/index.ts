// Subtitle types
export interface Subtitle {
  id: number;
  startTime: number; // u sekundama
  endTime: number; // u sekundama
  text: string;
  originalText?: string; // Originalni latiniični tekst pre konverzije
}

// Video types
export interface VideoFile {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  duration?: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface VideoProject {
  id: string;
  video: VideoFile;
  subtitles: Subtitle[];
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = 
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'editing'
  | 'exporting'
  | 'completed'
  | 'error';

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Video aspect ratio
export type AspectRatio = '16:9' | '9:16' | '1:1';

// Subtitle position
export type SubtitlePosition = 'top' | 'center' | 'bottom';

// Export options
export interface ExportOptions {
  format: 'mp4' | 'mkv' | 'webm';
  burnSubtitles: boolean; // Hardcode titlove u video
  subtitleFormat: 'srt' | 'vtt';
  quality: 'low' | 'medium' | 'high' | 'original';
  aspectRatio: AspectRatio;
  subtitlePosition: SubtitlePosition;
  fontSize: number; // 16-48
  fontColor: string; // hex color
  backgroundColor: string; // hex color with opacity
  maxCharsPerLine: number; // default 40
  maxLines: number; // default 2
}

// Transcription types
export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  language: string;
  duration: number;
}