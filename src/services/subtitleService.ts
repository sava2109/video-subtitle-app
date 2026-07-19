import { Subtitle, AspectRatio } from '../types';
import { ensureCyrillic } from '../utils/latinToCyrillic';
import { parseSRT, generateSRT, generateVTT } from '../utils/srtParser';
import {
  getMaxCharsPerLine,
  getMaxLines,
  wrapText,
  chunkLines,
  DEFAULT_FONT_SIZE,
  DEFAULT_MAX_BOX_WIDTH_PERCENT,
  DEFAULT_MAX_BOX_HEIGHT,
} from '../utils/subtitleLayout';

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
   * Get max characters per line based on aspect ratio and font size.
   * Иста формула као у прегледу (client/src/utils/subtitleLayout.ts).
   */
  getMaxCharsForRatio(aspectRatio: AspectRatio, fontSize: number = DEFAULT_FONT_SIZE): number {
    return getMaxCharsPerLine(aspectRatio, fontSize);
  }

  /**
   * Optimize subtitles for specific aspect ratio, font size and box limits.
   * Број редова по титлу произилази из висине кутије: вишак редова
   * постаје нови титл.
   */
  optimizeForAspectRatio(
    subtitles: Subtitle[],
    aspectRatio: AspectRatio,
    fontSize: number = DEFAULT_FONT_SIZE,
    maxBoxWidthPercent: number = DEFAULT_MAX_BOX_WIDTH_PERCENT,
    maxBoxHeightPx: number = DEFAULT_MAX_BOX_HEIGHT
  ): Subtitle[] {
    const maxCharsPerLine = getMaxCharsPerLine(aspectRatio, fontSize, maxBoxWidthPercent);
    const maxLines = getMaxLines(fontSize, maxBoxHeightPx);
    return this.optimizeSubtitles(subtitles, maxCharsPerLine, maxLines);
  }

  /**
   * Optimize subtitles for display — прелама текст у редове (макс. 2 реда)
   * и дели предугачке титлове у више узастопних, пропорционално по времену.
   * Иста логика преламања као у прегледу.
   */
  optimizeSubtitles(
    subtitles: Subtitle[],
    maxCharsPerLine: number = 40,
    maxLines: number = 2
  ): Subtitle[] {
    const optimized: Subtitle[] = [];
    let idCounter = 1;

    for (const sub of subtitles) {
      const lines = wrapText(sub.text, maxCharsPerLine);
      if (lines.length === 0) continue;

      const chunks = chunkLines(lines, maxLines);
      const duration = Math.max(0.2, sub.endTime - sub.startTime);
      const chunkDuration = duration / chunks.length;

      chunks.forEach((chunk, index) => {
        const startTime = sub.startTime + index * chunkDuration;
        const endTime = startTime + chunkDuration;

        optimized.push({
          id: idCounter++,
          startTime: Math.round(startTime * 1000) / 1000,
          endTime: Math.round(endTime * 1000) / 1000,
          text: chunk.join('\n'),
        });
      });
    }

    return this.preventOverlaps(optimized);
  }

  /**
   * Спречи преклапање узастопних титлова — НЕ мења трајање које је
   * корисник поставио, само скраћује крај ако улази у следећи титл.
   */
  private preventOverlaps(subtitles: Subtitle[]): Subtitle[] {
    return subtitles.map((sub, index) => {
      let { startTime, endTime } = sub;

      if (index < subtitles.length - 1) {
        const nextStart = subtitles[index + 1].startTime;
        if (endTime > nextStart) {
          endTime = nextStart;
        }
      }

      startTime = Math.max(0, startTime);
      endTime = Math.max(startTime + 0.2, endTime);

      return { ...sub, startTime, endTime };
    });
  }

  /**
   * Format subtitle text for display (wrap lines)
   */
  formatForDisplay(text: string, maxCharsPerLine: number = 40): string {
    const lines = wrapText(text, maxCharsPerLine);
    return lines.slice(0, 2).join('\n');
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
