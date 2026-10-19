import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './translations';

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: 'uz',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

export default i18n;
