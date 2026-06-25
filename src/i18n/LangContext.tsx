import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, type Lang, type TranslationKey } from './translations';

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LangContext = createContext<LangContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => translations[k].en,
  isRTL: false,
});

const STORAGE_KEY = 'pos_lang';

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Lang) ?? 'en';
  });

  const isRTL = lang === 'ar';

  // Apply dir + font class to <html> whenever language changes
  useEffect(() => {
    const html = document.documentElement;
    html.dir = isRTL ? 'rtl' : 'ltr';
    html.lang = lang;
    if (isRTL) {
      html.classList.add('lang-ar');
      html.classList.remove('lang-en');
    } else {
      html.classList.add('lang-en');
      html.classList.remove('lang-ar');
    }
  }, [lang, isRTL]);

  const setLang = useCallback((l: Lang) => {
    localStorage.setItem(STORAGE_KEY, l);
    setLangState(l);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[key][lang],
    [lang]
  );

  return (
    <LangContext.Provider value={{ lang, setLang, t, isRTL }}>
      {children}
    </LangContext.Provider>
  );
};

export const useLang = () => useContext(LangContext);
