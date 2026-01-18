import { Subtitle, AspectRatio } from '../types';
import { latinToCyrillic, ensureCyrillic } from '../utils/latinToCyrillic';
import { parseSRT, generateSRT, generateVTT } from '../utils/srtParser';

// Подешавања по формату - ШИРИ титлови
const CHARS_PER_LINE_BY_RATIO: Record<AspectRatio, number> = {
  '16:9': 42,  // Широк екран - више карактера
  '9:16': 40,  // Вертикалан (TikTok/Reels) - ШИРОКО
  '1:1': 35,   // Квадрат - средње
};

// Максималан број редова по формату
const MAX_LINES_BY_RATIO: Record<AspectRatio, number> = {
  '16:9': 2,   // 2 реда за широк екран
  '9:16': 2,   // 2 реда за вертикални
  '1:1': 2,    // 2 реда за квадрат
};

const MAX_LINES = 2;
const MIN_DURATION = 1.0; // минимум 1 секунда по титлу
const MAX_DURATION = 5.0; // максимум 5 секунди по титлу

export class SubtitleService {
  /**
   * Convert subtitles to Cyrillic
   */
  convertToCyrillic(subtitles: Subtitle[]): Subtitle[] {
    return subtitles.map(subtitle => ({
      ...subtitle,
      originalText: subtitle.text,
      text: ensureCyrillic(subtitle.text),
    }));
  }

  /**
   * Get max characters per line based on aspect ratio
   */
  getMaxCharsForRatio(aspectRatio: AspectRatio): number {
    return CHARS_PER_LINE_BY_RATIO[aspectRatio] || 40;
  }

  /**
   * Get max lines based on aspect ratio
   */
  getMaxLinesForRatio(aspectRatio: AspectRatio): number {
    return MAX_LINES_BY_RATIO[aspectRatio] || 2;
  }

  /**
   * Optimize subtitles for specific aspect ratio
   */
  optimizeForAspectRatio(subtitles: Subtitle[], aspectRatio: AspectRatio): Subtitle[] {
    const maxCharsPerLine = this.getMaxCharsForRatio(aspectRatio);
    const maxLines = this.getMaxLinesForRatio(aspectRatio);
    return this.optimizeSubtitles(subtitles, maxCharsPerLine, maxLines);
  }

  /**
   * Optimize subtitles for display - max 2 lines, proper timing
   */
  optimizeSubtitles(subtitles: Subtitle[], maxCharsPerLine: number = 40, maxLines: number = MAX_LINES): Subtitle[] {
    const optimized: Subtitle[] = [];
    let idCounter = 1;

    for (const sub of subtitles) {
      const segments = this.segmentText(sub.text, maxCharsPerLine, maxLines);
      const duration = sub.endTime - sub.startTime;
      const segmentDuration = duration / segments.length;

      segments.forEach((text, index) => {
        const startTime = sub.startTime + (index * segmentDuration);
        const endTime = startTime + segmentDuration;
        
        optimized.push({
          id: idCounter++,
          startTime: Math.round(startTime * 1000) / 1000,
          endTime: Math.round(endTime * 1000) / 1000,
          text: text,
        });
      });
    }

    return this.adjustTiming(optimized);
  }

  /**
   * Segment text into chunks that fit max lines with max chars per line
   */
  private segmentText(text: string, maxCharsPerLine: number, maxLines: number): string[] {
    // Clean existing newlines and normalize text
    const cleanText = text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    const words = cleanText.split(/\s+/);
    
    // For single line mode (9:16), just split by character limit, NO newlines
    if (maxLines === 1) {
      return this.segmentTextSingleLine(words, maxCharsPerLine);
    }
    
    // Multi-line mode (16:9, 1:1)
    const segments: string[] = [];
    let currentSegment: string[] = [];
    let currentLine = '';
    let lineCount = 0;

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        // Линија је пуна
        if (currentLine) {
          currentSegment.push(currentLine);
          lineCount++;
        }
        
        if (lineCount >= maxLines) {
          // Сегмент је пун
          segments.push(currentSegment.join('\n'));
          currentSegment = [];
          lineCount = 0;
        }
        
        currentLine = word;
      }
    }

    // Додај преосталу линију
    if (currentLine) {
      currentSegment.push(currentLine);
    }
    
    // Додај преостали сегмент
    if (currentSegment.length > 0) {
      segments.push(currentSegment.join('\n'));
    }

    return segments.length > 0 ? segments : [text];
  }

  /**
   * Segment text for single-line display (9:16 vertical format)
   * Each segment is ONE line only, no newlines
   */
  private segmentTextSingleLine(words: string[], maxCharsPerLine: number): string[] {
    const segments: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        // Line is full, save it and start new one
        if (currentLine) {
          segments.push(currentLine);
        }
        currentLine = word;
      }
    }

    // Add remaining text
    if (currentLine) {
      segments.push(currentLine);
    }

    return segments.length > 0 ? segments : [''];
  }

  /**
   * Adjust timing to ensure minimum duration and no overlaps
   */
  private adjustTiming(subtitles: Subtitle[]): Subtitle[] {
    return subtitles.map((sub, index) => {
      let { startTime, endTime } = sub;
      
      // Осигурај минималну дужину
      if (endTime - startTime < MIN_DURATION) {
        endTime = startTime + MIN_DURATION;
      }
      
      // Осигурај максималну дужину
      if (endTime - startTime > MAX_DURATION) {
        endTime = startTime + MAX_DURATION;
      }

      // Осигурај да не прелази у следећи титл
      if (index < subtitles.length - 1) {
        const nextStart = subtitles[index + 1].startTime;
        if (endTime > nextStart - 0.1) {
          endTime = nextStart - 0.1;
        }
      }

      return {
        ...sub,
        startTime: Math.max(0, startTime),
        endTime: Math.max(startTime + 0.5, endTime),
      };
    });
  }

  /**
   * Format subtitle text for display (wrap lines)
   */
  formatForDisplay(text: string, maxCharsPerLine: number = 40): string {
    if (text.includes('\n')) return text; // Већ форматирано
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      if (testLine.length <= maxCharsPerLine) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    return lines.slice(0, MAX_LINES).join('\n');
  }

  /**
   * Parse SRT content to subtitles
   */
  parseSRT(srtContent: string): Subtitle[] {
    return parseSRT(srtContent);
  }

  /**
   * Generate SRT from subtitles
   */
  generateSRT(subtitles: Subtitle[]): string {
    return generateSRT(subtitles);
  }

  /**
   * Generate VTT from subtitles
   */
  generateVTT(subtitles: Subtitle[]): string {
    return generateVTT(subtitles);
  }

  /**
   * Merge overlapping subtitles
   */
  mergeSubtitles(subtitles: Subtitle[], index1: number, index2: number): Subtitle[] {
    if (index1 >= subtitles.length || index2 >= subtitles.length) {
      return subtitles;
    }

    const sub1 = subtitles[Math.min(index1, index2)];
    const sub2 = subtitles[Math.max(index1, index2)];

    const merged: Subtitle = {
      id: sub1.id,
      startTime: Math.min(sub1.startTime, sub2.startTime),
      endTime: Math.max(sub1.endTime, sub2.endTime),
      text: `${sub1.text} ${sub2.text}`,
    };

    const newSubtitles = subtitles.filter((_, i) => i !== index1 && i !== index2);
    newSubtitles.splice(Math.min(index1, index2), 0, merged);

    // Re-number IDs
    return newSubtitles.map((sub, i) => ({ ...sub, id: i + 1 }));
  }

  /**
   * Split subtitle into two parts
   */
  splitSubtitle(subtitles: Subtitle[], index: number, splitTime: number): Subtitle[] {
    if (index >= subtitles.length) {
      return subtitles;
    }

    const original = subtitles[index];
    
    if (splitTime <= original.startTime || splitTime >= original.endTime) {
      return subtitles;
    }

    const words = original.text.split(' ');
    const midPoint = Math.floor(words.length / 2);
    
    const sub1: Subtitle = {
      id: original.id,
      startTime: original.startTime,
      endTime: splitTime,
      text: words.slice(0, midPoint).join(' '),
    };

    const sub2: Subtitle = {
      id: original.id + 1,
      startTime: splitTime,
      endTime: original.endTime,
      text: words.slice(midPoint).join(' '),
    };

    const newSubtitles = [...subtitles];
    newSubtitles.splice(index, 1, sub1, sub2);

    // Re-number IDs
    return newSubtitles.map((sub, i) => ({ ...sub, id: i + 1 }));
  }
}

export default SubtitleService;