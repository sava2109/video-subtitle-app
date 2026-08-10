import { Subtitle } from '../types';
import {
  DEFAULT_VERTICAL_POSITION,
  DEFAULT_MAX_BOX_WIDTH_PERCENT,
  LINE_HEIGHT_RATIO,
  LINE_GAP_RATIO,
  BOX_PADDING_RATIO,
} from './subtitleLayout';

/**
 * Генератор ASS (Advanced SubStation Alpha) титлова.
 *
 * За разлику од SRT + force_style, ASS нам даје пуну контролу:
 * PlayResX/PlayResY се поставе на СТВАРНУ резолуцију излазног видеа,
 * па је Fontsize = стварни пиксели у видеу. То омогућава да преглед
 * у прегледачу и експортовани видео изгледају идентично.
 */

export interface AssOptions {
  width: number;
  height: number;
  fontSize: number;
  fontColor: string; // RRGGBB hex, нпр. 'FFFFFF'
  /** Где стоји ДОЊА ивица титла, као % висине видеа од врха (5-98) */
  verticalPosition?: number;
  /** Максимална ширина кутије титла, као % ширине видеа */
  maxBoxWidthPercent?: number;
}

/**
 * Секунде -> ASS време (h:mm:ss.cc)
 */
function toAssTime(totalSeconds: number): string {
  const t = Math.max(0, totalSeconds);
  const hours = Math.floor(t / 3600);
  const minutes = Math.floor((t % 3600) / 60);
  const seconds = Math.floor(t % 60);
  const centiseconds = Math.round((t % 1) * 100);

  return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
}

/**
 * RRGGBB hex -> ASS боја (&HAABBGGRR — обрнут редослед, alpha 00 = непровидно)
 */
function toAssColor(rgbHex: string, alphaHex: string = '00'): string {
  const hex = rgbHex.replace(/[^0-9a-fA-F]/g, '').padEnd(6, 'F').slice(0, 6);
  const r = hex.slice(0, 2);
  const g = hex.slice(2, 4);
  const b = hex.slice(4, 6);
  return `&H${alphaHex}${b}${g}${r}`.toUpperCase();
}

/**
 * Очисти текст једног реда за ASS Dialogue: без {} тагова
 */
function escapeAssLine(text: string): string {
  return text.replace(/\{/g, '(').replace(/\}/g, ')');
}

export function generateASS(subtitles: Subtitle[], options: AssOptions): string {
  const {
    width,
    height,
    fontSize,
    fontColor,
    verticalPosition = DEFAULT_VERTICAL_POSITION,
    maxBoxWidthPercent = DEFAULT_MAX_BOX_WIDTH_PERCENT,
  } = options;

  // Alignment 2 = доле-центар: текст расте навише од доње ивице,
  // а доња ивица стоји на verticalPosition % висине видеа
  const alignment = 2;
  const clampedVertical = Math.min(98, Math.max(5, verticalPosition));
  const marginV = Math.round(height * (1 - clampedVertical / 100));

  // Хоризонталне маргине из максималне ширине кутије
  const clampedWidth = Math.min(98, Math.max(20, maxBoxWidthPercent));
  const marginH = Math.round((width * (1 - clampedWidth / 100)) / 2);

  // BorderStyle=3: полупровидна кутија иза сваког реда текста.
  // Код BorderStyle=3 кутија се боји OutlineColour бојом, а Outline
  // одређује унутрашњи размак кутије (padding).
  const boxPadding = Math.max(2, Math.round(fontSize * BOX_PADDING_RATIO));

  // Сваки ред титла иде као засебан Dialogue са \pos — кутије суседних
  // редова се тако НЕ преклапају, а између њих постоји видљив размак.
  const linePitch = Math.round(
    fontSize * LINE_HEIGHT_RATIO + 2 * boxPadding + fontSize * LINE_GAP_RATIO
  );
  const centerX = Math.round(width / 2);
  // \an2 сидри ДОЊУ ивицу текста, а кутија се шири још boxPadding ниже —
  // померамо навише за padding да доња ивица КУТИЈЕ стоји тачно на
  // verticalPosition, исто као у прегледу у прегледачу.
  const baseBottomY = Math.round(height * (clampedVertical / 100)) - boxPadding;

  const primaryColour = toAssColor(fontColor, '00');
  const outlineColour = toAssColor('000000', '80'); // ~50% провидна црна кутија
  const backColour = toAssColor('000000', '80');

  const header = `[Script Info]
Title: Titlovi
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709
PlayResX: ${width}
PlayResY: ${height}

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,${fontSize},${primaryColour},&H000000FF,${outlineColour},${backColour},0,0,0,0,100,100,0,0,3,${boxPadding},0,${alignment},${marginH},${marginH},${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  const events = subtitles
    .filter((s) => s.text && s.text.trim())
    .flatMap((s) => {
      const start = toAssTime(s.startTime);
      const end = toAssTime(s.endTime);
      const lines = s.text
        .trim()
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      // Доњи ред стоји на baseBottomY, сваки ред изнад је померен за linePitch
      return lines.map((line, i) => {
        const y = baseBottomY - (lines.length - 1 - i) * linePitch;
        const text = escapeAssLine(line);
        return `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\an2\\pos(${centerX},${y})}${text}`;
      });
    })
    .join('\n');

  return header + events + '\n';
}

export default { generateASS };
