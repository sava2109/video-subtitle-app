import { Router } from 'express';
import { SubtitleController } from '../controllers/transcriptionController';

const router = Router();
const subtitleController = new SubtitleController();

// Get subtitles for a video
router.get('/:videoId', subtitleController.getSubtitles.bind(subtitleController));

// Update subtitle
router.put('/:videoId/:subtitleId', subtitleController.updateSubtitle.bind(subtitleController));

// Update all subtitles for a video
router.put('/:videoId', subtitleController.updateAllSubtitles.bind(subtitleController));

// Delete subtitle
router.delete('/:videoId/:subtitleId', subtitleController.deleteSubtitle.bind(subtitleController));

// Download SRT file
router.get('/:videoId/download/srt', subtitleController.downloadSRT.bind(subtitleController));

// Download VTT file
router.get('/:videoId/download/vtt', subtitleController.downloadVTT.bind(subtitleController));

export default router;