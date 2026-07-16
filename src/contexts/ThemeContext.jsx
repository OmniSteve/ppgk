import { createContext, useContext, useLayoutEffect, useState } from 'react';

const ThemeContext = createContext({ theme: 'midnight', setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => {
      try { return localStorage.getItem('ppgk-theme') || 'midnight'; }
      catch (_) { return 'midnight'; }
    }
  );

  // Layout effect so data-theme is applied before any child's passive
  // effect reads theme CSS variables (GlobalDotGrid samples --primary).
  useLayoutEffect(() => {
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
