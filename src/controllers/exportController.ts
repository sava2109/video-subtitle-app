import { Request, Response } from 'express';
import path from 'path';
import { VideoProcessingService } from '../services/videoProcessingService';
import { SubtitleService } from '../services/subtitleService';
import { ExportOptions, AspectRatio } from '../types';
import { config } from '../config';
import { projects } from './videoController';

export class ExportController {
  private videoProcessingService: VideoProcessingService;
  private subtitleService: SubtitleService;

  constructor() {
    this.videoProcessingService = new VideoProcessingService();
    this.subtitleService = new SubtitleService();
  }

  // Export video with subtitles
  async exportVideoWithSubtitles(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params; // Route uses :id not :videoId
      console.log(`🎬 Export request for project: ${id}`);
      
      const { 
        burnSubtitles = true, 
        format = 'mp4',
        aspectRatio = '16:9',
        subtitlePosition = 'bottom',
        fontSize = 24,
        fontColor = 'FFFFFF',
        backgroundColor = '000000',
        maxLines = 2
      } = req.body;

      console.log(`📋 Export options: aspectRatio=${aspectRatio}, position=${subtitlePosition}, fontSize=${fontSize}`);

      // Get project from shared storage
      const project = projects.get(id);

      console.log(`📦 Project found: ${!!project}, Projects count: ${projects?.size || 0}`);

      if (!project) {
        console.log(`❌ Project not found: ${id}`);
        res.status(404).json({ success: false, error: 'Пројекат није пронађен. Молимо освежите страницу и поново отпремите видео.' });
        return;
      }

      console.log(`📹 Video path: ${project.video?.path}`);
      console.log(`📝 Subtitles count: ${project.subtitles?.length || 0}`);

      if (!project.subtitles || project.subtitles.length === 0) {
        res.status(400).json({ success: false, error: 'Нема титлова за експорт.' });
        return;
      }

      // Get optimal chars per line based on aspect ratio
      const maxCharsPerLine = this.subtitleService.getMaxCharsForRatio(aspectRatio as AspectRatio);
      
      // Optimize subtitles for the specific aspect ratio
      const optimizedSubtitles = this.subtitleService.optimizeForAspectRatio(
        project.subtitles,
        aspectRatio as AspectRatio
      );

      console.log(`📐 Aspect ratio: ${aspectRatio}, Max chars/line: ${maxCharsPerLine}`);
      console.log(`📝 Optimized ${project.subtitles.length} subtitles into ${optimizedSubtitles.length} segments`);

      const exportOptions: Partial<ExportOptions> = {
        burnSubtitles,
        aspectRatio,
        subtitlePosition,
        fontSize,
        fontColor,
        backgroundColor,
        maxCharsPerLine,
        maxLines
      };

      console.log('🎬 Exporting with options:', exportOptions);

      const outputPath = await this.videoProcessingService.exportVideoWithSubtitles(
        project.video.path,
        optimizedSubtitles,
        exportOptions
      );

      const ratioSuffix = aspectRatio.replace(':', 'x');
      const filename = `${path.basename(project.video.originalName, path.extname(project.video.originalName))}_${ratioSuffix}_subtitled.${format}`;

      console.log('✅ Export complete:', outputPath);

      // Return JSON with download URL (consistent with frontend expectations)
      res.json({
        success: true,
        data: {
          downloadUrl: `/exports/${path.basename(outputPath)}`,
          filename,
          message: 'Видео експортован!'
        }
      });
    } catch (error: any) {
      console.error('Export error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default ExportController;