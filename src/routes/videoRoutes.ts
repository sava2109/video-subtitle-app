import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { VideoController } from '../controllers/videoController';
import { ExportController } from '../controllers/exportController';
import { config } from '../config';

const router = Router();
const videoController = new VideoController();
const exportController = new ExportController();

// Осигурај да uploads фолдер постоји
if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

// Multer konfiguracija za upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Још једном провери да фолдер постоји
    if (!fs.existsSync(config.uploadsDir)) {
      fs.mkdirSync(config.uploadsDir, { recursive: true });
    }
    cb(null, config.uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (config.allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Тип фајла није подржан. Дозвољени типови: ${config.allowedExtensions.join(', ')}`));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: config.maxFileSize }
});

// Error handler за multer
const handleUpload = (req: any, res: any, next: any) => {
  console.log('📤 Upload request received');
  
  upload.single('video')(req, res, (err: any) => {
    if (err) {
      console.error('❌ Multer error:', err);
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ 
            success: false, 
            error: 'Фајл је превелик. Максимална величина је 500MB.' 
          });
        }
        return res.status(400).json({ success: false, error: err.message });
      }
      return res.status(400).json({ success: false, error: err.message });
    }
    
    console.log('✅ File received:', req.file?.originalname, req.file?.size, 'bytes');
    next();
  });
};

// Upload video
router.post('/upload', handleUpload, videoController.uploadVideo.bind(videoController));

// Get all videos
router.get('/', videoController.getVideos.bind(videoController));

// Get video by ID
router.get('/:id', videoController.getVideo.bind(videoController));

// Delete video
router.delete('/:id', videoController.deleteVideo.bind(videoController));

// Transcribe video (generate subtitles)
router.post('/:id/transcribe', videoController.transcribeVideo.bind(videoController));

// Export video with subtitles (use ExportController with full options)
router.post('/:id/export', exportController.exportVideoWithSubtitles.bind(exportController));

export default router;