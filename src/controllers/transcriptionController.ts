import { Request, Response } from 'express';
import { generateSRT, generateVTT, parseSRT } from '../utils/srtParser';
import { ensureCyrillic } from '../utils/latinToCyrillic';
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

  // Import subtitles from an SRT file (нпр. из бесплатних алата)
  async importSRT(req: Request, res: Response): Promise<void> {
    try {
      const { videoId } = req.params;
      const { srtContent, convertToCyrillic = true } = req.body;

      const project = getProject(videoId);
      if (!project) {
        res.status(404).json({ success: false, error: 'Пројекат није пронађен.' });
        return;
      }

      if (!srtContent || typeof srtContent !== 'string') {
        res.status(400).json({ success: false, error: 'Није послат садржај SRT фајла.' });
        return;
      }

      const parsed = parseSRT(srtContent);
      if (parsed.length === 0) {
        res.status(400).json({ success: false, error: 'SRT фајл није валидан или је празан.' });
        return;
      }

      project.subtitles = parsed.map((s: Subtitle, i: number) => ({
        ...s,
        id: i + 1,
        text: convertToCyrillic ? ensureCyrillic(s.text) : s.text,
      }));
      project.status = 'transcribed';
      project.updatedAt = new Date();

      res.json({
        success: true,
        data: { subtitles: project.subtitles, message: `Увезено ${parsed.length} титлова.` }
      });
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