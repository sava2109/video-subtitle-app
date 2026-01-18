import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { SpeechToTextService } from '../services/speechToTextService';
import { VideoProcessingService } from '../services/videoProcessingService';
import { SubtitleService } from '../services/subtitleService';
import { latinToCyrillic } from '../utils/latinToCyrillic';
import { VideoProject, Subtitle } from '../types';
import { config } from '../config';

// In-memory storage (u produkciji koristiti bazu)
export const projects: Map<string, VideoProject> = new Map();

export class VideoController {
  private speechToTextService: SpeechToTextService;
  private videoProcessingService: VideoProcessingService;
  private subtitleService: SubtitleService;

  constructor() {
    this.speechToTextService = new SpeechToTextService();
    this.videoProcessingService = new VideoProcessingService();
    this.subtitleService = new SubtitleService();
  }

  // Upload video
  async uploadVideo(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'Није послат видео фајл.' });
        return;
      }

      const projectId = uuidv4();
      const project: VideoProject = {
        id: projectId,
        video: {
          id: uuidv4(),
          originalName: req.file.originalname,
          filename: req.file.filename,
          path: req.file.path,
          size: req.file.size,
          mimeType: req.file.mimetype,
          uploadedAt: new Date(),
        },
        subtitles: [],
        status: 'uploaded',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Get video duration
      try {
        project.video.duration = await this.videoProcessingService.getVideoDuration(req.file.path);
      } catch (e) {
        console.error('Could not get video duration:', e);
      }

      projects.set(projectId, project);

      res.status(200).json({
        success: true,
        data: {
          projectId,
          video: project.video,
          message: 'Видео успешно уплоадован!'
        }
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get all videos
  async getVideos(req: Request, res: Response): Promise<void> {
    try {
      const projectList = Array.from(projects.values()).map(p => ({
        id: p.id,
        video: p.video,
        status: p.status,
        subtitleCount: p.subtitles.length,
        createdAt: p.createdAt,
      }));

      res.json({ success: true, data: projectList });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Get single video
  async getVideo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const project = projects.get(id);

      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      res.json({ success: true, data: project });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete video
  async deleteVideo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const project = projects.get(id);

      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      // Delete video file
      if (fs.existsSync(project.video.path)) {
        fs.unlinkSync(project.video.path);
      }

      projects.delete(id);
      res.json({ success: true, message: 'Пројекат обрисан.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Transcribe video
  async transcribeVideo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { 
        convertToCyrillic = true,
        noiseReduction = true,
        noiseReductionLevel = 21,
        highpassFilter = 200,
        lowpassFilter = 3000
      } = req.body;
      
      const project = projects.get(id);
      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      project.status = 'transcribing';
      projects.set(id, project);

      // Extract audio and transcribe with noise reduction options
      const transcription = await this.speechToTextService.transcribe(project.video.path, {
        noiseReduction,
        noiseReductionLevel,
        highpassFilter,
        lowpassFilter
      });

      // Convert to subtitles
      let subtitles: Subtitle[] = transcription.segments.map((seg, index) => ({
        id: index + 1,
        startTime: seg.start,
        endTime: seg.end,
        text: convertToCyrillic ? latinToCyrillic(seg.text) : seg.text,
        originalText: seg.text,
      }));

      // Optimize subtitles - split into max 2 lines, 40 chars per line
      subtitles = this.subtitleService.optimizeSubtitles(subtitles, 40, 2);
      // Convert optimized subtitles to Cyrillic
      subtitles = this.subtitleService.convertToCyrillic(subtitles);

      project.subtitles = subtitles;
      project.status = 'transcribed';
      project.updatedAt = new Date();
      projects.set(id, project);

      res.json({
        success: true,
        data: {
          subtitles,
          message: 'Транскрипција завршена!'
        }
      });
    } catch (error: any) {
      console.error('Transcription error:', error);
      const project = projects.get(req.params.id);
      if (project) {
        project.status = 'error';
        projects.set(req.params.id, project);
      }
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Export video with burned subtitles
  async exportVideo(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { burnSubtitles = true, format = 'mp4' } = req.body;
      
      const project = projects.get(id);
      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      if (project.subtitles.length === 0) {
        res.status(400).json({ success: false, error: 'Нема титлова за експорт.' });
        return;
      }

      project.status = 'exporting';
      projects.set(id, project);

      const outputPath = await this.videoProcessingService.exportVideoWithSubtitles(
        project.video.path,
        project.subtitles,
        burnSubtitles
      );

      project.status = 'completed';
      projects.set(id, project);

      const filename = `${path.basename(project.video.originalName, path.extname(project.video.originalName))}_subtitled.${format}`;
      
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

export default VideoController;