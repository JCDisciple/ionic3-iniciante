import { DarkTheme, DefaultTheme, type Theme } from 'expo-router';

/**
 * Paleta "papel e tinta" para os lugares que precisam de cor em JS (ícones,
 * navegação, StatusBar). Mantenha em sincronia com as variáveis de src/global.css;
 * em componentes, prefira as classes do Tailwind (bg-paper, text-ink, ...).
 */
export const Palette = {
  light: {
    paper: '#F7F3EC',
    surface: '#FFFDF8',
    sunken: '#EEE8DD',
    ink: '#1F1B16',
    muted: '#665E53',
    line: '#E2DACC',
    accent: '#A84C25',
    onAccent: '#FFFDF8',
    danger: '#B02A2A',
    success: '#2E6E40',
  },
  dark: {
    paper: '#15130F',
    surface: '#1F1C17',
    sunken: '#28241E',
    ink: '#F2ECE2',
    muted: '#ADA496',
    line: '#3A352D',
    accent: '#E68E62',
    onAccent: '#15130F',
    danger: '#F08078',
    success: '#7EC492',
  },
} as const;

export type PaletteColors = (typeof Palette)['light'] | (typeof Palette)['dark'];

export function navigationTheme(scheme: 'light' | 'dark'): Theme {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = Palette[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.accent,
      background: c.paper,
      card: c.surface,
      text: c.ink,
      border: c.line,
      notification: c.accent,
    },
  };
}

/** Largura máxima do conteúdo na web/tablet, para não esticar em telas grandes. */
export const MaxContentWidth = 720;
