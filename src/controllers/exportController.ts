import { Request, Response } from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { VideoProcessingService } from '../services/videoProcessingService';
import { SubtitleService } from '../services/subtitleService';
import { ExportOptions, AspectRatio } from '../types';
import {
  DEFAULT_FONT_SIZE,
  DEFAULT_VERTICAL_POSITION,
  DEFAULT_MAX_BOX_WIDTH_PERCENT,
  DEFAULT_MAX_BOX_HEIGHT,
} from '../utils/subtitleLayout';
import { config } from '../config';
import { projects } from './videoController';

interface ExportJob {
  id: string;
  status: 'processing' | 'done' | 'error';
  progress: number; // 0-100
  downloadUrl?: string;
  filename?: string;
  savedTo?: string;
  exportsFolder?: string;
  error?: string;
  startedAt: number;
}

// In-memory праћење експорт послова
const exportJobs = new Map<string, ExportJob>();

// Почисти старе послове (старије од 2 сата)
function cleanupOldJobs(): void {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  Array.from(exportJobs.entries()).forEach(([id, job]) => {
    if (job.startedAt < cutoff) exportJobs.delete(id);
  });
}

export class ExportController {
  private videoProcessingService: VideoProcessingService;
  private subtitleService: SubtitleService;

  constructor() {
    this.videoProcessingService = new VideoProcessingService();
    this.subtitleService = new SubtitleService();
  }

  /**
   * Покрени експорт као позадински посао — одмах враћа jobId,
   * а напредак се прати преко GET /videos/export-status/:jobId
   */
  async exportVideoWithSubtitles(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      console.log(`🎬 Export request for project: ${id}`);

      const {
        burnSubtitles = true,
        aspectRatio = '16:9',
        fontSize = DEFAULT_FONT_SIZE,
        fontColor = 'FFFFFF',
        verticalPosition = DEFAULT_VERTICAL_POSITION,
        maxBoxWidthPercent = DEFAULT_MAX_BOX_WIDTH_PERCENT,
        maxBoxHeightPx = DEFAULT_MAX_BOX_HEIGHT,
      } = req.body;

      console.log(`📋 Export options: ratio=${aspectRatio}, font=${fontSize}px, vPos=${verticalPosition}%, boxW=${maxBoxWidthPercent}%, boxH=${maxBoxHeightPx}px`);

      const project = projects.get(id);

      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен. Молимо освежите страницу и поново отпремите видео.' });
        return;
      }

      if (!project.subtitles || project.subtitles.length === 0) {
        res.status(400).json({ success: false, error: 'Нема титлова за експорт.' });
        return;
      }

      cleanupOldJobs();

      const jobId = uuidv4();
      const job: ExportJob = {
        id: jobId,
        status: 'processing',
        progress: 0,
        startedAt: Date.now(),
      };
      exportJobs.set(jobId, job);

      // Одговори одмах — клијент прати напредак преко jobId
      res.json({ success: true, data: { jobId } });

      // Позадинска обрада
      this.runExportJob(job, project, {
        burnSubtitles,
        aspectRatio,
        fontSize,
        fontColor,
        verticalPosition,
        maxBoxWidthPercent,
        maxBoxHeightPx,
      }).catch((err) => {
        console.error('Export job error:', err);
        job.status = 'error';
        job.error = err.message;
      });
    } catch (error: any) {
      console.error('Export error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  private async runExportJob(
    job: ExportJob,
    project: any,
    options: Partial<ExportOptions>
  ): Promise<void> {
    const {
      aspectRatio = '16:9',
      fontSize = DEFAULT_FONT_SIZE,
      maxBoxWidthPercent = DEFAULT_MAX_BOX_WIDTH_PERCENT,
      maxBoxHeightPx = DEFAULT_MAX_BOX_HEIGHT,
    } = options;

    // Прелом истом логиком као у прегледу, па обавезна ћирилица
    let optimizedSubtitles = this.subtitleService.optimizeForAspectRatio(
      project.subtitles,
      aspectRatio as AspectRatio,
      fontSize,
      maxBoxWidthPercent,
      maxBoxHeightPx
    );
    optimizedSubtitles = this.subtitleService.convertToCyrillic(optimizedSubtitles);

    console.log(`📝 Optimized ${project.subtitles.length} subtitles into ${optimizedSubtitles.length} segments`);

    const outputPath = await this.videoProcessingService.exportVideoWithSubtitles(
      project.video.path,
      optimizedSubtitles,
      { ...options, originalName: project.video.originalName },
      (percent) => { job.progress = percent; }
    );

    const outputFilename = path.basename(outputPath);

    console.log('✅ Export complete:', outputPath);

    job.status = 'done';
    job.progress = 100;
    job.downloadUrl = `/exports/${encodeURIComponent(outputFilename)}`;
    job.filename = outputFilename;
    job.savedTo = outputPath;
    job.exportsFolder = config.exportsDir;
  }

  /**
   * Статус експорт посла — проценат напретка и резултат
   */
  async getExportStatus(req: Request, res: Response): Promise<void> {
    const { jobId } = req.params;
    const job = exportJobs.get(jobId);

    if (!job) {
      res.status(404).json({ success: false, error: 'Експорт посао није пронађен.' });
      return;
    }

    res.json({
      success: true,
      data: {
        status: job.status,
        progress: job.progress,
        downloadUrl: job.downloadUrl,
        filename: job.filename,
        savedTo: job.savedTo,
        exportsFolder: job.exportsFolder,
        error: job.error,
      }
    });
  }
}

export default ExportController;
