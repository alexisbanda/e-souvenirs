// ThemeProvider.tsx
import React, { useEffect } from 'react';
import { themes, ThemeKey } from '../themes';
import { Company } from '../types/company';

interface ThemeProviderProps {
  company?: Company;
  children: React.ReactNode;
}

function applyTheme(themeKey: ThemeKey) {
  const theme = themes[themeKey] || themes['default'];
  Object.entries(theme).forEach(([key, value]) => {
    document.documentElement.style.setProperty(`--${key}`, value);
  });
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ company, children }) => {
  useEffect(() => {
    const themeKey = company?.settings?.theme || 'default';
    applyTheme(themeKey as ThemeKey);
  }, [company]);

  return <>{children}</>;
};
