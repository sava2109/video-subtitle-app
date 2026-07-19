/**
 * Конверзија српске латинице у ћирилицу (клијентска верзија —
 * иста логика као src/utils/latinToCyrillic.ts на серверу).
 */

// Мапа за конверзију — двословне комбинације морају бити прве
const latinToCyrillicMap: { [key: string]: string } = {
  'Lj': 'Љ', 'LJ': 'Љ', 'lj': 'љ',
  'Nj': 'Њ', 'NJ': 'Њ', 'nj': 'њ',
  'Dž': 'Џ', 'DŽ': 'Џ', 'dž': 'џ',
  'Dz': 'Џ', 'DZ': 'Џ', 'dz': 'џ',
  'Đ': 'Ђ', 'đ': 'ђ',
  'DJ': 'Ђ', 'Dj': 'Ђ', 'dj': 'ђ',

  'A': 'А', 'B': 'Б', 'V': 'В', 'G': 'Г', 'D': 'Д',
  'E': 'Е', 'Ž': 'Ж', 'Z': 'З', 'I': 'И', 'J': 'Ј',
  'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н', 'O': 'О',
  'P': 'П', 'R': 'Р', 'S': 'С', 'T': 'Т', 'Ć': 'Ћ',
  'U': 'У', 'F': 'Ф', 'H': 'Х', 'C': 'Ц', 'Č': 'Ч', 'Š': 'Ш',

  'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д',
  'e': 'е', 'ž': 'ж', 'z': 'з', 'i': 'и', 'j': 'ј',
  'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
  'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'ć': 'ћ',
  'u': 'у', 'f': 'ф', 'h': 'х', 'c': 'ц', 'č': 'ч', 'š': 'ш',
};

export function latinToCyrillic(text: string): string {
  if (!text) return '';

  let result = '';
  let i = 0;

  while (i < text.length) {
    let found = false;

    if (i + 1 < text.length) {
      const twoChars = text.substring(i, i + 2);
      if (latinToCyrillicMap[twoChars]) {
        result += latinToCyrillicMap[twoChars];
        i += 2;
        found = true;
      }
    }

    if (!found) {
      const oneChar = text[i];
      result += latinToCyrillicMap[oneChar] || oneChar;
      i++;
    }
  }

  return result;
}

export function isCyrillic(text: string): boolean {
  if (!text) return false;
  const cyrillicMatches = text.match(/[Ѐ-ӿ]/g) || [];
  const latinMatches = text.match(/[a-zA-Z]/g) || [];
  return cyrillicMatches.length > latinMatches.length;
}

export function ensureCyrillic(text: string): string {
  return isCyrillic(text) ? text : latinToCyrillic(text);
}
