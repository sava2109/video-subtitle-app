import { Request, Response } from 'express';
import { generateSRT, generateVTT } from '../utils/srtParser';
import { Subtitle } from '../types';

// Shared storage reference (u produkciji koristiti bazu)
const getProject = (id: string) => {
  // Import from videoController's projects map
  const { projects } = require('./videoController');
  return projects?.get(id);
};

export class SubtitleController {
  // Get subtitles for a video
  async getSubtitles(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const project = getProject(videoId);

      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      res.json({ success: true, data: project.subtitles });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Update single subtitle
  async updateSubtitle(req: Request, res: Response): Promise<void> {
    try {
      const { videoId, subtitleId } = req.params;
      const { text, startTime, endTime } = req.body;
      
      const project = getProject(videoId);
      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      const subtitleIndex = project.subtitles.findIndex(
        (s: Subtitle) => s.id === parseInt(subtitleId)
      );

      if (subtitleIndex === -1) {
        res.status(404).json({ success: false, error: 'Титл није пронађен.' });
        return;
      }

      if (text !== undefined) project.subtitles[subtitleIndex].text = text;
      if (startTime !== undefined) project.subtitles[subtitleIndex].startTime = startTime;
      if (endTime !== undefined) project.subtitles[subtitleIndex].endTime = endTime;

      project.updatedAt = new Date();

      res.json({ success: true, data: project.subtitles[subtitleIndex] });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Update all subtitles
  async updateAllSubtitles(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const { subtitles } = req.body;
      
      const project = getProject(videoId);
      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      project.subtitles = subtitles;
      project.updatedAt = new Date();

      res.json({ success: true, data: project.subtitles });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Delete subtitle
  async deleteSubtitle(req: Request, res: Response): Promise<void> {
    try {
      const { videoId, subtitleId } = req.params;
      
      const project = getProject(videoId);
      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      project.subtitles = project.subtitles.filter(
        (s: Subtitle) => s.id !== parseInt(subtitleId)
      );
      project.updatedAt = new Date();

      res.json({ success: true, message: 'Титл обрисан.' });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Download SRT
  async downloadSRT(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const project = getProject(videoId);

      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      const srtContent = generateSRT(project.subtitles);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="subtitles.srt"`);
      res.send(srtContent);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }

  // Download VTT
  async downloadVTT(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const project = getProject(videoId);

      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      const vttContent = generateVTT(project.subtitles);
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="subtitles.vtt"`);
      res.send(vttContent);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

export default SubtitleController;