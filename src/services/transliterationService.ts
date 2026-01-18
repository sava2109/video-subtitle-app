import { latinToCyrillic, cyrillicToLatin, isCyrillic, ensureCyrillic } from '../utils/latinToCyrillic';

export class TransliterationService {
  /**
   * Convert text from Latin to Cyrillic
   */
  toCyrillic(text: string): string {
    return latinToCyrillic(text);
  }

  /**
   * Convert text from Cyrillic to Latin
   */
  toLatin(text: string): string {
    return cyrillicToLatin(text);
  }

  /**
   * Check if text is in Cyrillic
   */
  isCyrillic(text: string): boolean {
    return isCyrillic(text);
  }

  /**
   * Ensure text is in Cyrillic (convert if needed)
   */
  ensureCyrillic(text: string): string {
    return ensureCyrillic(text);
  }

  /**
   * Convert array of strings to Cyrillic
   */
  convertArrayToCyrillic(texts: string[]): string[] {
    return texts.map(text => this.toCyrillic(text));
  }
}

// Export function for compatibility
export function transliterate(text: string): string {
  return latinToCyrillic(text);
}

export default TransliterationService;