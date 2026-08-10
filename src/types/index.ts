// Subtitle types
export interface Subtitle {
  id: number;
  startTime: number; // u sekundama
  endTime: number; // u sekundama
  text: string;
  originalText?: string; // Originalni latiniični tekst pre konverzije
}

// Video types
export interface VideoFile {
  id: string;
  originalName: string;
  filename: string;
  path: string;
  size: number;
  duration?: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface VideoProject {
  id: string;
  video: VideoFile;
  subtitles: Subtitle[];
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectStatus = 
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'editing'
  | 'exporting'
  | 'completed'
  | 'error';

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Video aspect ratio
export type AspectRatio = '16:9' | '9:16' | '1:1';

// Subtitle position
export type SubtitlePosition = 'top' | 'center' | 'bottom';

// Export options
export interface ExportOptions {
  format: 'mp4' | 'mkv' | 'webm';
  burnSubtitles: boolean; // Hardcode titlove u video
  subtitleFormat: 'srt' | 'vtt';
  quality: 'low' | 'medium' | 'high' | 'original';
  aspectRatio: AspectRatio;
  subtitlePosition: SubtitlePosition;
  fontSize: number; // пиксели у излазном видеу
  fontColor: string; // hex color
  backgroundColor: string; // hex color with opacity
  maxCharsPerLine: number; // default 40
  maxLines: number; // default 2
  verticalPosition: number; // доња ивица титла, % висине видеа од врха (5-98)
  maxBoxWidthPercent: number; // макс. ширина кутије титла, % ширине видеа
  maxBoxHeightPx: number; // макс. висина кутије титла у px (одређује број редова)
}

// Transcription types
export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  language: string;
  duration: number;
  /** true = демо титлови (нема API кључа), нису препис снимка */
  isDemo?: boolean;
}