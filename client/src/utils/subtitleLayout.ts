/**
 * ЗАЈЕДНИЧКА ЛОГИКА РАСПОРЕДА ТИТЛОВА
 *
 * ВАЖНО: Ове константе и функције морају бити ИДЕНТИЧНЕ са
 * src/utils/subtitleLayout.ts на серверу — то гарантује да преглед
 * (preview) у прегледачу изгледа исто као експортовани видео (WYSIWYG).
 */

export type AspectRatio = '16:9' | '9:16' | '1:1';

export interface TargetDims {
  width: number;
  height: number;
}

// Фиксне излазне резолуције по формату
export const TARGET_DIMS: Record<AspectRatio, TargetDims> = {
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
  '1:1': { width: 1080, height: 1080 },
};

// Просечна ширина карактера у односу на величину фонта (Arial, ћирилица)
export const CHAR_WIDTH_RATIO = 0.55;

// Висина једног реда у односу на величину фонта
export const LINE_HEIGHT_RATIO = 1.1;

// Размак између кутија суседних редова, у односу на величину фонта.
// Спречава преклапање позадине (кутије) првог и другог реда.
export const LINE_GAP_RATIO = 0.12;

// Унутрашњи размак кутије (padding), у односу на величину фонта
export const BOX_PADDING_RATIO = 0.1;

// Подразумеване вредности подешавања (пиксели/проценти ИЗЛАЗНОГ видеа)
export const DEFAULT_FONT_SIZE = 64;
export const DEFAULT_VERTICAL_POSITION = 95; // доња ивица титла на 95% висине
export const DEFAULT_MAX_BOX_WIDTH_PERCENT = 92; // макс. ширина кутије (% ширине видеа)
export const DEFAULT_MAX_BOX_HEIGHT = 145; // макс. висина кутије у px (~2 реда за 64px фонт)

/**
 * Максималан број редова који стаје у задату висину кутије.
 * Вишак редова се дели у нови (следећи) титл.
 */
export function getMaxLines(fontSize: number, maxBoxHeightPx: number): number {
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;
  return Math.min(10, Math.max(1, Math.floor(maxBoxHeightPx / lineHeight)));
}

/**
 * Максималан број карактера по реду за дати формат, величину фонта
 * и максималну ширину кутије (% ширине видеа).
 */
export function getMaxCharsPerLine(
  ratio: AspectRatio,
  fontSize: number,
  maxBoxWidthPercent: number = DEFAULT_MAX_BOX_WIDTH_PERCENT
): number {
  const dims = TARGET_DIMS[ratio] || TARGET_DIMS['16:9'];
  const usableWidth = dims.width * (maxBoxWidthPercent / 100);
  return Math.max(8, Math.floor(usableWidth / (fontSize * CHAR_WIDTH_RATIO)));
}

/**
 * Прелама текст у редове са максималним бројем карактера.
 * Не сече речи — реч дужа од лимита иде сама у ред.
 */
export function wrapText(text: string, maxCharsPerLine: number): string[] {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return [];

  const words = cleanText.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= maxCharsPerLine || !currentLine) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);

  return lines;
}

/**
 * Групише редове у блокове од по највише maxLines редова.
 * Сваки блок постаје један титл на екрану.
 */
export function chunkLines(lines: string[], maxLines: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines));
  }
  return chunks;
}

/**
 * Текст који треба приказати у прегледу за дато време унутар титла.
 * Ако титл не стаје у кутију (ширина × висина), дели се на исте блокове
 * као при експорту, а блок се бира пропорционално протеклом времену.
 */
export function getDisplayTextAtTime(
  text: string,
  startTime: number,
  endTime: number,
  currentTime: number,
  ratio: AspectRatio,
  fontSize: number,
  maxBoxWidthPercent: number,
  maxBoxHeightPx: number
): string {
  const maxChars = getMaxCharsPerLine(ratio, fontSize, maxBoxWidthPercent);
  const maxLines = getMaxLines(fontSize, maxBoxHeightPx);
  const lines = wrapText(text, maxChars);
  if (lines.length === 0) return '';

  const chunks = chunkLines(lines, maxLines);
  if (chunks.length === 1) return chunks[0].join('\n');

  const duration = Math.max(0.2, endTime - startTime);
  const progress = Math.min(0.999, Math.max(0, (currentTime - startTime) / duration));
  const index = Math.min(chunks.length - 1, Math.floor(progress * chunks.length));

  return chunks[index].join('\n');
}
