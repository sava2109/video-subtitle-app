import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  
  // Putanje
  uploadsDir: path.join(__dirname, '../../uploads'),
  exportsDir: path.join(__dirname, '../../exports'),
  
  // OpenAI Whisper API (preporučeno za srpski)
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  
  // Video processing
  maxFileSize: 500 * 1024 * 1024, // 500MB
  allowedVideoTypes: ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska', 'video/webm'],
  allowedExtensions: ['.mp4', '.avi', '.mov', '.mkv', '.webm'],
  
  // Subtitle defaults
  defaultSubtitleStyle: {
    fontName: 'Arial',
    fontSize: 24,
    fontColor: 'white',
    outlineColor: 'black',
    outlineWidth: 2,
  },
};

export default config;