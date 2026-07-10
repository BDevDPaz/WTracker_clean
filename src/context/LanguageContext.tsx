<<<<<<< HEAD
import React, { createContext, useState, useEffect, useContext, memo } from 'react';
import { ensureDbReady } from '../database/db';
import { translations } from '../utils/i18n';
import { Language } from '../types';
import { log } from '../utils/logger';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: typeof translations['es'];
=======
// src/context/LanguageContext.tsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { getDB } from '../database/db';
import { translations } from '../utils/i18n';
import { Language } from '../types';

// Definimos qué datos comparte este contexto
interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: typeof translations['es']; // Tipado automático de las traducciones
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

<<<<<<< HEAD
export const LanguageProvider = memo(({ children }: { children: React.ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('es');

  useEffect(() => {
    const loadLang = async () => {
      try {
        const db = await ensureDbReady();
=======
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>('es');

  // Cargar idioma guardado al iniciar la app
  useEffect(() => {
    const loadLang = async () => {
      try {
        const db = getDB();
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
        const res = await db.getFirstAsync<{ language: Language }>('SELECT language FROM settings WHERE id = 1');
        if (res?.language) {
          setLanguageState(res.language);
        }
      } catch (e) {
<<<<<<< HEAD
        log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error cargando idioma de la base de datos', e);
      }
    };
    void loadLang();
  }, []);

  const setLanguage = async (newLang: Language) => {
    try {
      const db = await ensureDbReady();
      await db.runAsync('UPDATE settings SET language = ? WHERE id = 1', [newLang]);
      setLanguageState(newLang);
    } catch (e) {
      log('ROJO', 'ERROR_CRITICO', 'ERROR', 'Error guardando idioma en la base de datos', e);
    }
  };

=======
        console.error("Error cargando idioma", e);
      }
    };
    loadLang();
  }, []);

  // Función para cambiar idioma (Guarda en DB y actualiza Estado)
  const setLanguage = async (newLang: Language) => {
    try {
      const db = getDB();
      await db.runAsync('UPDATE settings SET language = ? WHERE id = 1', [newLang]);
      setLanguageState(newLang); // Esto actualiza toda la UI inmediatamente
    } catch (e) {
      console.error("Error guardando idioma", e);
    }
  };

  // Obtener el diccionario actual
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
<<<<<<< HEAD
});

LanguageProvider.displayName = 'LanguageProvider';

=======
};

// Hook personalizado para usar el idioma fácil en cualquier pantalla
>>>>>>> 415a8f1 (Baseline limpio extraído desde v2.2.0)
export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage debe usarse dentro de un LanguageProvider");
  return context;
};
