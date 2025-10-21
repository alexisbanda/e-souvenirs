// themes.ts
// Centralized theme definitions for company branding

export type ThemeKey =
  | 'default'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'rose'
  | 'slate'
  | 'amber'
  | 'lavender'
  | 'mint';

export interface ThemeConfig {
  'brand-primary': string;
  'brand-secondary': string;
  'brand-accent': string;
  'brand-text': string;
  'brand-light': string;
  'brand-on-primary': string;
}

export const themes: Record<ThemeKey, ThemeConfig> = {
  default: {
    'brand-primary': '#8d6e63',
    'brand-secondary': '#f5f5f5',
    'brand-accent': '#a1887f',
    'brand-text': '#4e342e',
    'brand-light': '#efebe9',
    'brand-on-primary': '#fff',
  },
  ocean: {
    'brand-primary': '#1976d2',
    'brand-secondary': '#e3f2fd',
    'brand-accent': '#00bcd4',
    'brand-text': '#0d47a1',
    'brand-light': '#bbdefb',
    'brand-on-primary': '#fff',
  },
  forest: {
    'brand-primary': '#388e3c',
    'brand-secondary': '#e8f5e9',
    'brand-accent': '#8bc34a',
    'brand-text': '#1b5e20',
    'brand-light': '#c8e6c9',
    'brand-on-primary': '#fff',
  },
  sunset: {
    'brand-primary': '#ff7043',
    'brand-secondary': '#fff3e0',
    'brand-accent': '#fbc02d',
    'brand-text': '#bf360c',
    'brand-light': '#ffe0b2',
    'brand-on-primary': '#fff',
  },
  rose: {
    'brand-primary': '#d81b60',
    'brand-secondary': '#fce4ec',
    'brand-accent': '#f06292',
    'brand-text': '#880e4f',
    'brand-light': '#f8bbd0',
    'brand-on-primary': '#fff',
  },
  slate: {
    'brand-primary': '#607d8b',
    'brand-secondary': '#eceff1',
    'brand-accent': '#90a4ae',
    'brand-text': '#263238',
    'brand-light': '#cfd8dc',
    'brand-on-primary': '#fff',
  },
  amber: {
    'brand-primary': '#ffb300',
    'brand-secondary': '#fff8e1',
    'brand-accent': '#ffca28',
    'brand-text': '#ff6f00',
    'brand-light': '#ffe082',
    'brand-on-primary': '#fff',
  },
  lavender: {
    'brand-primary': '#7e57c2',
    'brand-secondary': '#ede7f6',
    'brand-accent': '#b39ddb',
    'brand-text': '#4527a0',
    'brand-light': '#d1c4e9',
    'brand-on-primary': '#fff',
  },
  mint: {
    'brand-primary': '#26a69a',
    'brand-secondary': '#e0f2f1',
    'brand-accent': '#80cbc4',
    'brand-text': '#004d40',
    'brand-light': '#b2dfdb',
    'brand-on-primary': '#fff',
  },
};
