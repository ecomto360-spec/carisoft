import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fr, type TranslationKey } from './locales/fr';
import { en } from './locales/en';
import { ar } from './locales/ar';
import { Language, LANGUAGES, LanguageOption } from './types';

export * from './types';
export { fr, en, ar };

const translations: Record<Language, TranslationKey> = {
  fr,
  en,
  ar,
};

interface I18nState {
  language: Language;
  setLanguage: (lang: Language) => void;
}

// Ensure html dir and lang attributes are applied
function applyDirectionAndLang(lang: Language) {
  const isRtl = lang === 'ar';
  document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
  document.documentElement.setAttribute('lang', lang);
  if (isRtl) {
    document.documentElement.classList.add('rtl');
  } else {
    document.documentElement.classList.remove('rtl');
  }
}

export const useI18nStore = create<I18nState>()(
  persist(
    (set) => ({
      language: 'fr',
      setLanguage: (language: Language) => {
        applyDirectionAndLang(language);
        set({ language });
      },
    }),
    {
      name: 'carisoft-language-preference',
      onRehydrateStorage: () => (state) => {
        if (state?.language) {
          applyDirectionAndLang(state.language);
        } else {
          applyDirectionAndLang('fr');
        }
      },
    }
  )
);

// Initialize direction on script load
if (typeof window !== 'undefined') {
  try {
    const stored = localStorage.getItem('carisoft-language-preference');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.state?.language) {
        applyDirectionAndLang(parsed.state.language);
      }
    } else {
      applyDirectionAndLang('fr');
    }
  } catch (e) {
    applyDirectionAndLang('fr');
  }
}

/**
 * Main translation hook
 */
export function useTranslation() {
  const { language, setLanguage } = useI18nStore();
  const currentTranslations = translations[language] || fr;
  const isRTL = language === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';

  const currentOption = LANGUAGES.find((l) => l.code === language) || LANGUAGES[0];

  return {
    t: currentTranslations,
    language,
    setLanguage,
    isRTL,
    dir,
    languages: LANGUAGES,
    currentOption,
  };
}

/**
 * Helper to get current translations outside of React components
 */
export function getTranslations(lang?: Language): TranslationKey {
  const activeLang = lang || useI18nStore.getState().language || 'fr';
  return translations[activeLang] || fr;
}

/**
 * Localized format currency (supports DZD in FR/EN/AR)
 */
export function formatLocalizedCurrency(amount: number, lang: Language = 'fr'): string {
  const num = Number(amount) || 0;
  if (lang === 'ar') {
    return `${new Intl.NumberFormat('ar-DZ', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(num)} د.ج`;
  }
  if (lang === 'en') {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(num)} DZD`;
  }
  return `${new Intl.NumberFormat('fr-DZ', { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(num)} DA`;
}

/**
 * Localized format date
 */
export function formatLocalizedDate(date: string | Date | undefined | null, lang: Language = 'fr'): string {
  if (!date) return '';
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-');
    return `${d}/${m}/${y}`;
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return String(date);
  const locale = lang === 'ar' ? 'ar-DZ' : lang === 'en' ? 'en-US' : 'fr-FR';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}
