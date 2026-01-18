import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { Subtitle, ExportOptions, AspectRatio, SubtitlePosition } from '../types';
import { generateSRT } from '../utils/srtParser';
import { config } from '../config';

const execPromise = promisify(exec);

interface VideoInfo {
  width: number;
  height: number;
  duration: number;
}

export class VideoProcessingService {
  private ffmpegPath: string;
  private ffprobePath: string;

  constructor() {
    // Use system ffmpeg in production (Render has it), ffmpeg-static locally
    if (process.env.NODE_ENV === 'production') {
      this.ffmpegPath = 'ffmpeg';
      this.ffprobePath = 'ffprobe';
    } else {
      this.ffmpegPath = require('ffmpeg-static');
      this.ffprobePath = this.ffmpegPath.replace('ffmpeg', 'ffprobe');
    }
  }

  /**
   * Get video info (width, height, duration, rotation)
   */
  async getVideoInfo(videoPath: string): Promise<VideoInfo & { rotation?: number }> {
    const command = `"${this.ffmpegPath}" -i "${videoPath}" 2>&1`;
    
    let width = 1920, height = 1080, duration = 0, rotation = 0;
    
    try {
      await execPromise(command);
    } catch (error: any) {
      const output = error.stderr || error.message || '';
      
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
   * Calculate crop/scale parameters for aspect ratio
   */
  private getAspectRatioFilter(
    sourceWidth: number, 
    sourceHeight: number, 
    targetRatio: AspectRatio
  ): string {
    const ratios: Record<AspectRatio, number> = {
      '16:9': 16/9,
      '9:16': 9/16,
      '1:1': 1
    };
    
    const targetRatioValue = ratios[targetRatio];
    const sourceRatioValue = sourceWidth / sourceHeight;
    
    let cropW: number, cropH: number, cropX: number, cropY: number;
    
    if (sourceRatioValue > targetRatioValue) {
      // Source is wider - crop sides
      cropH = sourceHeight;
      cropW = Math.round(sourceHeight * targetRatioValue);
      cropX = Math.round((sourceWidth - cropW) / 2);
      cropY = 0;
    } else {
      // Source is taller or equal - crop top/bottom
      cropW = sourceWidth;
      cropH = Math.round(sourceWidth / targetRatioValue);
      // If cropH is larger than source, use source height and recalculate width
      if (cropH > sourceHeight) {
        cropH = sourceHeight;
        cropW = Math.round(sourceHeight * targetRatioValue);
        cropX = Math.round((sourceWidth - cropW) / 2);
        cropY = 0;
      } else {
        cropX = 0;
        cropY = Math.round((sourceHeight - cropH) / 2);
      }
    }
    
    // Ensure even numbers for codec compatibility
    cropW = Math.max(2, cropW - (cropW % 2));
    cropH = Math.max(2, cropH - (cropH % 2));
    
    // Ensure crop doesn't exceed source dimensions
    cropW = Math.min(cropW, sourceWidth);
    cropH = Math.min(cropH, sourceHeight);
    cropX = Math.max(0, Math.min(cropX, sourceWidth - cropW));
    cropY = Math.max(0, Math.min(cropY, sourceHeight - cropH));
    
    return `crop=${cropW}:${cropH}:${cropX}:${cropY}`;
  }

  /**
   * Get subtitle position Y value based on position and video height
   */
  private getSubtitleY(position: SubtitlePosition, videoHeight: number, fontSize: number): string {
    const margin = 30;
    const lineHeight = fontSize * 1.2;
    const twoLineHeight = lineHeight * 2;
    
    switch (position) {
      case 'top':
        return `y=${margin}`;
      case 'center':
        return `y=(h-${twoLineHeight})/2`;
      case 'bottom':
      default:
        return `y=h-${twoLineHeight}-${margin}`;
    }
  }

  /**
   * Export video with burned-in subtitles and formatting options
   */
  async exportVideoWithSubtitles(
    videoPath: string,
    subtitles: Subtitle[],
    options: Partial<ExportOptions> = {}
  ): Promise<string> {
    const {
      burnSubtitles = true,
      aspectRatio = '16:9',
      subtitlePosition = 'bottom',
      fontSize = 24,
      fontColor = 'FFFFFF',
      backgroundColor = '000000',
      maxCharsPerLine = 40,
      maxLines = 2,
    } = options;

    const outputId = uuidv4();
    const outputPath = path.join(config.exportsDir, `${outputId}.mp4`);
    
    // Get video info (already accounts for rotation)
    const videoInfo = await this.getVideoInfo(videoPath);
    console.log(`📐 Video info: ${videoInfo.width}x${videoInfo.height}, rotation: ${(videoInfo as any).rotation || 0}`);
    
    // Create SRT file with optimized subtitles
    const srtPath = path.join(config.exportsDir, `${outputId}.srt`);
    const srtContent = generateSRT(subtitles);
    fs.writeFileSync(srtPath, srtContent, 'utf-8');

    const filters: string[] = [];
    
    // Check if video needs aspect ratio adjustment
    const currentRatio = videoInfo.width / videoInfo.height;
    const targetRatios: Record<AspectRatio, number> = {
      '16:9': 16/9,
      '9:16': 9/16,
      '1:1': 1
    };
    const targetRatio = targetRatios[aspectRatio];
    
    // Only crop if the video aspect ratio is significantly different from target
    const ratioDiff = Math.abs(currentRatio - targetRatio);
    if (ratioDiff > 0.1) {
      const cropFilter = this.getAspectRatioFilter(videoInfo.width, videoInfo.height, aspectRatio);
      filters.push(cropFilter);
      console.log(`📐 Adding crop filter: ${cropFilter}`);
    } else {
      console.log(`📐 Video already close to target ratio, skipping crop`);
    }

    if (burnSubtitles) {
      // Escape path for FFmpeg filter (replace backslashes and colons)
      const escapedSrtPath = srtPath
        .replace(/\\/g, '/')
        .replace(/:/g, '\\:');
      
      // Calculate margins based on aspect ratio
      let marginV = 30;
      let marginL = 20;  // Left margin
      let marginR = 20;  // Right margin
      
      // For 9:16 (vertical), use minimal margins to maximize text width
      if (aspectRatio === '9:16') {
        marginL = 5;
        marginR = 5;
        marginV = 50;  // A bit more space from bottom
      } else if (aspectRatio === '1:1') {
        marginL = 15;
        marginR = 15;
      }
      
      if (subtitlePosition === 'top') {
        marginV = 30;
      } else if (subtitlePosition === 'center') {
        marginV = Math.round(videoInfo.height / 2 - fontSize);
      }
      
      // Build subtitle filter with styling - WrapStyle=0 for smart wrapping
      const subtitleFilter = `subtitles='${escapedSrtPath}':force_style='FontName=Arial,FontSize=${fontSize},PrimaryColour=&H${fontColor},OutlineColour=&H${backgroundColor},Outline=2,BackColour=&H80000000,BorderStyle=4,MarginV=${marginV},MarginL=${marginL},MarginR=${marginR},Alignment=${subtitlePosition === 'top' ? 6 : subtitlePosition === 'center' ? 5 : 2},WrapStyle=0'`;
      
      filters.push(subtitleFilter);
    }

    // Build FFmpeg command
    let filterComplex = filters.length > 0 ? `-vf "${filters.join(',')}"` : '';
    
    const command = `"${this.ffmpegPath}" -i "${videoPath}" ${filterComplex} -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y "${outputPath}"`;
    
    console.log('🎬 Export command:', command);
    
    await execPromise(command);
    
    // Cleanup temp SRT
    if (fs.existsSync(srtPath)) {
      fs.unlinkSync(srtPath);
    }

    return outputPath;
  }

  /**
   * Export with specific aspect ratio only (no subtitles)
   */
  async exportWithAspectRatio(
    videoPath: string,
    aspectRatio: AspectRatio
  ): Promise<string> {
    const outputId = uuidv4();
    const outputPath = path.join(config.exportsDir, `${outputId}.mp4`);
    
    const videoInfo = await this.getVideoInfo(videoPath);
    const cropFilter = this.getAspectRatioFilter(videoInfo.width, videoInfo.height, aspectRatio);
    
    const command = `"${this.ffmpegPath}" -i "${videoPath}" -vf "${cropFilter}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k -y "${outputPath}"`;
    
    await execPromise(command);
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