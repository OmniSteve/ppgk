import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'classic', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => {
      try { return localStorage.getItem('ppgk-theme') || 'classic'; }
      catch (_) { return 'classic'; }
    }
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('ppgk-theme', theme); } catch (_) {}
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
