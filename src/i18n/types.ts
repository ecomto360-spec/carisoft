export type Language = 'fr' | 'en' | 'ar';
export type Direction = 'ltr' | 'rtl';

export interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  dir: Direction;
}

export const LANGUAGES: LanguageOption[] = [
  { code: 'fr', name: 'Français', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'ar', name: 'Arabe', nativeName: 'العربية', flag: '🇩🇿', dir: 'rtl' },
  { code: 'en', name: 'Anglais', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' },
];
