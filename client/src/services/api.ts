import axios from 'axios';

// Use relative URL in production, localhost in development
const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '/api' 
  : 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 минута timeout за велике фајлове
  withCredentials: true, // Important for cookies/auth
});

// Video API
export const uploadVideo = async (file: File) => {
  const formData = new FormData();
  formData.append('video', file);
  
  console.log('Starting upload for file:', file.name, 'size:', file.size);
  
  try {
    const response = await api.post('/videos/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
        console.log('Upload progress:', percentCompleted + '%');
      },
    });
    console.log('Upload response:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('Upload error full:', error);
    console.error('Upload error response:', error.response);
    console.error('Upload error message:', error.message);
    console.error('Upload error code:', error.code);
    
    // Детаљнија порука о грешци
    let errorMessage = 'Грешка при уплоаду видеа';
    
    if (error.code === 'ERR_NETWORK') {
      errorMessage = 'Мрежна грешка - проверите интернет конекцију';
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Истекло време за уплоад - покушајте са мањим фајлом';
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    const customError = new Error(errorMessage);
    throw customError;
  }
};

export const getVideos = async () => {
  const response = await api.get('/videos');
  return response.data;
};

export const getVideo = async (projectId: string) => {
  const response = await api.get(`/videos/${projectId}`);
  return response.data;
};

export const deleteVideo = async (projectId: string) => {
  const response = await api.delete(`/videos/${projectId}`);
  return response.data;
};

// Transcription API
export interface TranscribeOptions {
  noiseReduction?: boolean;
  noiseReductionLevel?: number;
  highpassFilter?: number;
  lowpassFilter?: number;
}

export const transcribeVideo = async (
  projectId: string, 
  convertToCyrillic = true,
  options: TranscribeOptions = {}
) => {
  const response = await api.post(`/videos/${projectId}/transcribe`, { 
    convertToCyrillic,
    noiseReduction: options.noiseReduction ?? true,
    noiseReductionLevel: options.noiseReductionLevel ?? 21,
    highpassFilter: options.highpassFilter ?? 200,
    lowpassFilter: options.lowpassFilter ?? 3000,
  });
  return response.data;
};

// Subtitles API
export const getSubtitles = async (projectId: string) => {
  const response = await api.get(`/subtitles/${projectId}`);
  return response.data;
};

export const updateSubtitle = async (projectId: string, subtitleId: number, data: any) => {
  const response = await api.put(`/subtitles/${projectId}/${subtitleId}`, data);
  return response.data;
};

export const updateAllSubtitles = async (projectId: string, subtitles: any[]) => {
  const response = await api.put(`/subtitles/${projectId}`, { subtitles });
  return response.data;
};

export const deleteSubtitle = async (projectId: string, subtitleId: number) => {
  const response = await api.delete(`/subtitles/${projectId}/${subtitleId}`);
  return response.data;
};

export const downloadSRT = async (projectId: string) => {
  const response = await api.get(`/subtitles/${projectId}/download/srt`, {
    responseType: 'blob',
  });
  return response.data;
};

export const downloadVTT = async (projectId: string) => {
  const response = await api.get(`/subtitles/${projectId}/download/vtt`, {
    responseType: 'blob',
  });
  return response.data;
};

// Export API
export interface ExportVideoOptions {
  burnSubtitles?: boolean;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  subtitlePosition?: 'top' | 'center' | 'bottom';
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
}

export const exportVideo = async (projectId: string, options: ExportVideoOptions = {}) => {
  const response = await api.post(`/videos/${projectId}/export`, {
    burnSubtitles: options.burnSubtitles ?? true,
    aspectRatio: options.aspectRatio ?? '16:9',
    subtitlePosition: options.subtitlePosition ?? 'bottom',
    fontSize: options.fontSize ?? 24,
    fontColor: options.fontColor ?? 'FFFFFF',
    backgroundColor: options.backgroundColor ?? '000000',
  });
  return response.data;
};

// Fetch subtitles (alias for compatibility)
export const fetchSubtitles = getSubtitles;

export default api;