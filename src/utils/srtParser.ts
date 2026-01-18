import { Subtitle } from '../types';

/**
 * Konvertuje vreme iz SRT formata (HH:MM:SS,mmm) u sekunde
 */
export function srtTimeToSeconds(srtTime: string): number {
  const match = srtTime.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
  if (!match) return 0;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const seconds = parseInt(match[3], 10);
  const milliseconds = parseInt(match[4], 10);
  
  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}

/**
 * Konvertuje sekunde u SRT format (HH:MM:SS,mmm)
 */
export function secondsToSrtTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.round((totalSeconds % 1) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Parsira SRT string u niz Subtitle objekata
 */
export function parseSRT(srtContent: string): Subtitle[] {
  const subtitles: Subtitle[] = [];
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\n+/).filter(block => block.trim());
  
  for (const block of blocks) {
    const lines = block.split('\n').filter(line => line.trim());
    if (lines.length < 3) continue;
    
    const id = parseInt(lines[0], 10);
    if (isNaN(id)) continue;
    
    const timeMatch = lines[1].match(/(\d{2}:\d{2}:\d{2}[,.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{3})/);
    if (!timeMatch) continue;
    
    const startTime = srtTimeToSeconds(timeMatch[1]);
    const endTime = srtTimeToSeconds(timeMatch[2]);
    const text = lines.slice(2).join('\n');
    
    subtitles.push({ id, startTime, endTime, text });
  }
  
  return subtitles;
}

/**
 * Generiše SRT string iz niza Subtitle objekata
 */
export function generateSRT(subtitles: Subtitle[]): string {
  return subtitles
    .map((subtitle, index) => {
      const id = subtitle.id || index + 1;
      const startTime = secondsToSrtTime(subtitle.startTime);
      const endTime = secondsToSrtTime(subtitle.endTime);
      return `${id}\n${startTime} --> ${endTime}\n${subtitle.text}`;
    })
    .join('\n\n') + '\n';
}

/**
 * Generiše VTT string iz niza Subtitle objekata
 */
export function generateVTT(subtitles: Subtitle[]): string {
  const header = 'WEBVTT\n\n';
  const content = subtitles
    .map((subtitle) => {
      const startTime = secondsToSrtTime(subtitle.startTime).replace(',', '.');
      const endTime = secondsToSrtTime(subtitle.endTime).replace(',', '.');
      return `${startTime} --> ${endTime}\n${subtitle.text}`;
    })
    .join('\n\n');
  
  return header + content + '\n';
}

export default { parseSRT, generateSRT, generateVTT, srtTimeToSeconds, secondsToSrtTime };