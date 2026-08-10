import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Subtitle, ExportOptions, AspectRatio } from '../types';
import { generateASS } from '../utils/assGenerator';
import {
  TARGET_DIMS,
  DEFAULT_FONT_SIZE,
  DEFAULT_VERTICAL_POSITION,
  DEFAULT_MAX_BOX_WIDTH_PERCENT,
} from '../utils/subtitleLayout';
import { config } from '../config';

const execPromise = promisify(exec);

interface VideoInfo {
  width: number;
  height: number;
  duration: number;
  rotation?: number;
}

export class VideoProcessingService {
  private ffmpegPath: string;

  constructor() {
    // Use system ffmpeg in production (Render has it), ffmpeg-static locally
    if (process.env.NODE_ENV === 'production') {
      this.ffmpegPath = 'ffmpeg';
    } else {
      this.ffmpegPath = require('ffmpeg-static');
    }
  }

  /**
   * Get video info (width, height, duration, rotation)
   */
  async getVideoInfo(videoPath: string): Promise<VideoInfo> {
    const command = `"${this.ffmpegPath}" -i "${videoPath}" 2>&1`;

    let width = 1920, height = 1080, duration = 0, rotation = 0;

    try {
      await execPromise(command);
    } catch (error: any) {
      // 2>&1 шаље ffmpeg испис у stdout, па проверавамо оба
      const output = `${error.stdout || ''}\n${error.stderr || ''}\n${error.message || ''}`;

      // Duration
      const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
      if (durationMatch) {
        duration = parseInt(durationMatch[1]) * 3600 +
                   parseInt(durationMatch[2]) * 60 +
                   parseInt(durationMatch[3]);
      }

      // Resolution
      const resMatch = output.match(/(\d{3,4})x(\d{3,4})/);
      if (resMatch) {
        width = parseInt(resMatch[1]);
        height = parseInt(resMatch[2]);
      }

      // Check for rotation
      const rotationMatch = output.match(/rotation of (-?\d+)/);
      if (rotationMatch) {
        rotation = parseInt(rotationMatch[1]);
      }

      // If video is rotated 90 or -90 degrees, swap width and height
      if (Math.abs(rotation) === 90) {
        [width, height] = [height, width];
      }
    }

    return { width, height, duration, rotation };
  }

  /**
   * Get video duration in seconds
   */
  async getVideoDuration(videoPath: string): Promise<number> {
    const info = await this.getVideoInfo(videoPath);
    return info.duration;
  }

  /**
   * Crop филтер преко израза (iw/ih) — не зависи од стварних димензија,
   * па ради исправно и за ротиране снимке (FFmpeg аутоматски примени
   * ротацију из метаподатака ПРЕ филтера). Центриран рез, парне димензије.
   */
  private getCropScaleFilters(aspectRatio: AspectRatio): string[] {
    const target = TARGET_DIMS[aspectRatio] || TARGET_DIMS['16:9'];
    const r = (target.width / target.height).toFixed(6);

    const cropW = `floor(min(iw,ih*${r})/2)*2`;
    const cropH = `floor(min(ih,iw/${r})/2)*2`;

    return [
      `crop='${cropW}':'${cropH}'`,
      `scale=${target.width}:${target.height}`,
      'setsar=1',
    ];
  }

  /**
   * Направи безбедно име излазног фајла од оригиналног имена видеа.
   */
  private buildOutputName(originalName: string | undefined, aspectRatio: AspectRatio): string {
    const base = (originalName
      ? path.basename(originalName, path.extname(originalName))
      : 'video')
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
      .replace(/\s+/g, '_')
      .trim() || 'video';

    const now = new Date();
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
    ].join('') + '_' + [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0'),
    ].join('');

    const ratioSuffix = aspectRatio.replace(':', 'x');
    return `${base}_${ratioSuffix}_${stamp}.mp4`;
  }

  /**
   * Export video with burned-in subtitles and formatting options.
   *
   * Видео се сече (crop) на изабрани формат и скалира на фиксну резолуцију
   * (16:9 -> 1920x1080, 9:16 -> 1080x1920, 1:1 -> 1080x1080), а титлови се
   * пеку преко ASS фајла чији PlayRes одговара тој резолуцији — величина
   * фонта је тако СТВАРНИ број пиксела у видеу, исто као у прегледу.
   */
  async exportVideoWithSubtitles(
    videoPath: string,
    subtitles: Subtitle[],
    options: Partial<ExportOptions> & { originalName?: string } = {},
    onProgress?: (percent: number) => void
  ): Promise<string> {
    const {
      burnSubtitles = true,
      aspectRatio = '16:9',
      fontSize = DEFAULT_FONT_SIZE,
      fontColor = 'FFFFFF',
      verticalPosition = DEFAULT_VERTICAL_POSITION,
      maxBoxWidthPercent = DEFAULT_MAX_BOX_WIDTH_PERCENT,
      originalName,
    } = options;

    const target = TARGET_DIMS[aspectRatio as AspectRatio] || TARGET_DIMS['16:9'];

    const outputName = this.buildOutputName(originalName, aspectRatio as AspectRatio);
    const outputPath = path.join(config.exportsDir, outputName);

    // Трајање улаза — потребно за рачунање процента напретка
    const inputInfo = await this.getVideoInfo(videoPath);
    const totalDuration = inputInfo.duration;

    const filters: string[] = this.getCropScaleFilters(aspectRatio as AspectRatio);

    let assPath: string | null = null;

    if (burnSubtitles) {
      assPath = path.join(config.exportsDir, `${uuidv4()}.ass`);
      const assContent = generateASS(subtitles, {
        width: target.width,
        height: target.height,
        fontSize,
        fontColor,
        verticalPosition,
        maxBoxWidthPercent,
      });
      fs.writeFileSync(assPath, assContent, 'utf-8');

      // Escape path for FFmpeg filter (forward slashes, escaped colon)
      const escapedAssPath = assPath
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:');

      filters.push(`subtitles='${escapedAssPath}'`);
    }

    const args = [
      '-i', videoPath,
      '-vf', filters.join(','),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-progress', 'pipe:1',
      '-y', outputPath,
    ];

    console.log('🎬 Export command:', this.ffmpegPath, args.join(' '));

    try {
      await this.runFfmpegWithProgress(args, totalDuration, onProgress);
    } finally {
      // Cleanup temp ASS file
      if (assPath && fs.existsSync(assPath)) {
        fs.unlinkSync(assPath);
      }
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg није направио излазни фајл.');
    }

    return outputPath;
  }

  /**
   * Рендеруј ЈЕДАН фрејм са упеченим титловима — исти crop/scale/ASS
   * pipeline као при експорту, па је слика пиксел-идентична експорту.
   * Враћа путању до PNG фајла (позивалац брише после слања).
   */
  async renderPreviewFrame(
    videoPath: string,
    subtitles: Subtitle[],
    options: Partial<ExportOptions> = {},
    timeSec: number = 0
  ): Promise<string> {
    const {
      aspectRatio = '16:9',
      fontSize = DEFAULT_FONT_SIZE,
      fontColor = 'FFFFFF',
      verticalPosition = DEFAULT_VERTICAL_POSITION,
      maxBoxWidthPercent = DEFAULT_MAX_BOX_WIDTH_PERCENT,
    } = options;

    const target = TARGET_DIMS[aspectRatio as AspectRatio] || TARGET_DIMS['16:9'];
    const outputPath = path.join(config.exportsDir, `preview_${uuidv4()}.png`);
    const filters: string[] = this.getCropScaleFilters(aspectRatio as AspectRatio);

    const assPath = path.join(config.exportsDir, `${uuidv4()}.ass`);
    const assContent = generateASS(subtitles, {
      width: target.width,
      height: target.height,
      fontSize,
      fontColor,
      verticalPosition,
      maxBoxWidthPercent,
    });
    fs.writeFileSync(assPath, assContent, 'utf-8');

    const escapedAssPath = assPath.replace(/\\/g, '/').replace(/:/g, '\\:');
    filters.push(`subtitles='${escapedAssPath}'`);

    // -ss пре -i уз -copyts: брзо тражење, а оригинални timestamp се чува
    // па libass приказује титл који важи баш у том тренутку
    const command = `"${this.ffmpegPath}" -ss ${Math.max(0, timeSec)} -copyts -i "${videoPath}" -vf "${filters.join(',')}" -frames:v 1 -y "${outputPath}"`;

    try {
      await execPromise(command, { maxBuffer: 50 * 1024 * 1024 });
    } finally {
      if (fs.existsSync(assPath)) fs.unlinkSync(assPath);
    }

    if (!fs.existsSync(outputPath)) {
      throw new Error('FFmpeg није направио фрејм за преглед.');
    }

    return outputPath;
  }

  /**
   * Покрени ffmpeg преко spawn-а и јављај проценат напретка.
   * -progress pipe:1 исписује out_time= редове на stdout.
   */
  private runFfmpegWithProgress(
    args: string[],
    totalDurationSec: number,
    onProgress?: (percent: number) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.ffmpegPath, args, { windowsHide: true });

      let stderrTail = '';

      proc.stdout.on('data', (data: Buffer) => {
        if (!onProgress || totalDurationSec <= 0) return;
        const match = data.toString().match(/out_time=(\d+):(\d{2}):(\d{2})\.(\d+)/);
        if (match) {
          const seconds =
            parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
          const percent = Math.min(99, Math.round((seconds / totalDurationSec) * 100));
          onProgress(percent);
        }
      });

      proc.stderr.on('data', (data: Buffer) => {
        stderrTail = (stderrTail + data.toString()).slice(-4000);
      });

      proc.on('error', (err) => reject(err));

      proc.on('close', (code) => {
        if (code === 0) {
          if (onProgress) onProgress(100);
          resolve();
        } else {
          const lastLines = stderrTail.trim().split('\n').slice(-5).join('\n');
          reject(new Error(`FFmpeg грешка (код ${code}): ${lastLines}`));
        }
      });
    });
  }

  /**
   * Export with specific aspect ratio only (no subtitles)
   */
  async exportWithAspectRatio(
    videoPath: string,
    aspectRatio: AspectRatio
  ): Promise<string> {
    const outputPath = path.join(config.exportsDir, this.buildOutputName(undefined, aspectRatio));
    const filters = this.getCropScaleFilters(aspectRatio);

    const command = `"${this.ffmpegPath}" -i "${videoPath}" -vf "${filters.join(',')}" -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 128k -movflags +faststart -y "${outputPath}"`;

    await execPromise(command, { maxBuffer: 50 * 1024 * 1024 });
    return outputPath;
  }

  /**
   * Create video thumbnail
   */
  async createThumbnail(videoPath: string): Promise<string> {
    const thumbnailPath = videoPath.replace(/\.[^/.]+$/, '_thumb.jpg');
    const command = `"${this.ffmpegPath}" -i "${videoPath}" -ss 00:00:01 -vframes 1 -y "${thumbnailPath}"`;

    await execPromise(command);
    return thumbnailPath;
  }
}

export default VideoProcessingService;
