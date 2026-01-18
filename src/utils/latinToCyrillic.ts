/**
 * Konverzija srpske latinice u ćirilicu
 * Serbian Latin to Cyrillic conversion
 */

// Mapa za konverziju - dvoslovne kombinacije moraju biti prve
const latinToCyrillicMap: { [key: string]: string } = {
  // Dvoslovne kombinacije (digraphs) - MORAJU BITI PRVE
  'Lj': 'Љ', 'LJ': 'Љ', 'lj': 'љ',
  'Nj': 'Њ', 'NJ': 'Њ', 'nj': 'њ',
  'Dž': 'Џ', 'DŽ': 'Џ', 'dž': 'џ',
  'Dz': 'Џ', 'DZ': 'Џ', 'dz': 'џ',
  'Đ': 'Ђ', 'đ': 'ђ',
  'DJ': 'Ђ', 'Dj': 'Ђ', 'dj': 'ђ',
  
  // Velika slova
  'A': 'А', 'B': 'Б', 'V': 'В', 'G': 'Г', 'D': 'Д',
  'E': 'Е', 'Ž': 'Ж', 'Z': 'З', 'I': 'И', 'J': 'Ј',
  'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н', 'O': 'О',
  'P': 'П', 'R': 'Р', 'S': 'С', 'T': 'Т', 'Ć': 'Ћ',
  'U': 'У', 'F': 'Ф', 'H': 'Х', 'C': 'Ц', 'Č': 'Ч', 'Š': 'Ш',
  
  // Mala slova
  'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д',
  'e': 'е', 'ž': 'ж', 'z': 'з', 'i': 'и', 'j': 'ј',
  'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
  'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'ć': 'ћ',
  'u': 'у', 'f': 'ф', 'h': 'х', 'c': 'ц', 'č': 'ч', 'š': 'ш',
};

/**
 * Konvertuje tekst sa latinice na ćirilicu
 * @param text - Tekst na latinici
 * @returns Tekst na ćirilici
 */
export function latinToCyrillic(text: string): string {
  if (!text) return '';
  
  let result = '';
  let i = 0;
  
  while (i < text.length) {
    let found = false;
    
    // Proveri dvo-slovne kombinacije
    if (i + 1 < text.length) {
      const twoChars = text.substring(i, i + 2);
      if (latinToCyrillicMap[twoChars]) {
        result += latinToCyrillicMap[twoChars];
        i += 2;
        found = true;
      }
    }
    
    // Ako nije pronađena dvo-slovna kombinacija, proveri jedno slovo
    if (!found) {
      const oneChar = text[i];
      if (latinToCyrillicMap[oneChar]) {
        result += latinToCyrillicMap[oneChar];
      } else {
        // Zadrži originalni karakter (brojevi, interpunkcija, itd.)
        result += oneChar;
      }
      i++;
    }
  }
  
  return result;
}

/**
 * Konvertuje ćirilicu nazad u latinicu
 */
export function cyrillicToLatin(text: string): string {
  if (!text) return '';
  
  const cyrillicToLatinMap: { [key: string]: string } = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D',
    'Ђ': 'Đ', 'Е': 'E', 'Ж': 'Ž', 'З': 'Z', 'И': 'I',
    'Ј': 'J', 'К': 'K', 'Л': 'L', 'Љ': 'Lj', 'М': 'M',
    'Н': 'N', 'Њ': 'Nj', 'О': 'O', 'П': 'P', 'Р': 'R',
    'С': 'S', 'Т': 'T', 'Ћ': 'Ć', 'У': 'U', 'Ф': 'F',
    'Х': 'H', 'Ц': 'C', 'Ч': 'Č', 'Џ': 'Dž', 'Ш': 'Š',
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd',
    'ђ': 'đ', 'е': 'e', 'ж': 'ž', 'з': 'z', 'и': 'i',
    'ј': 'j', 'к': 'k', 'л': 'l', 'љ': 'lj', 'м': 'm',
    'н': 'n', 'њ': 'nj', 'о': 'o', 'п': 'p', 'р': 'r',
    'с': 's', 'т': 't', 'ћ': 'ć', 'у': 'u', 'ф': 'f',
    'х': 'h', 'ц': 'c', 'ч': 'č', 'џ': 'dž', 'ш': 'š',
  };
  
  return text.split('').map(char => cyrillicToLatinMap[char] || char).join('');
}

/**
 * Detektuje da li je tekst na ćirilici
 */
export function isCyrillic(text: string): boolean {
  if (!text) return false;
  const cyrillicRegex = /[\u0400-\u04FF]/g;
  const latinRegex = /[a-zA-Z]/g;
  const cyrillicMatches = text.match(cyrillicRegex) || [];
  const latinMatches = text.match(latinRegex) || [];
  return cyrillicMatches.length > latinMatches.length;
}

/**
 * Automatski konvertuje tekst u ćirilicu ako je na latinici
 */
export function ensureCyrillic(text: string): string {
  if (isCyrillic(text)) {
    return text;
  }
  return latinToCyrillic(text);
}

export default { latinToCyrillic, cyrillicToLatin, isCyrillic, ensureCyrillic };