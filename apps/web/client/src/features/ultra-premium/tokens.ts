// Direction 03 — Ultra-Premium Productivity Platform
// Apple-level discipline, highly minimal, elegant, spacious, investor-grade.
// Palette: near-white bg, almost-black text, single cobalt accent — extreme restraint.

export const D3 = {
  bg: '#F8F8F6',
  surface: '#FFFFFF',
  surfaceSubtle: '#F2F2EF',
  border: 'rgba(0,0,0,0.06)',
  borderMid: 'rgba(0,0,0,0.10)',
  accent: '#0052CC',
  accentSoft: 'rgba(0,82,204,0.07)',
  accentMid: 'rgba(0,82,204,0.15)',
  accentStrong: '#003D99',
  success: '#00875A',
  successSoft: 'rgba(0,135,90,0.08)',
  danger: '#C9372C',
  dangerSoft: 'rgba(201,55,44,0.08)',
  warning: '#974F0C',
  warningSoft: 'rgba(151,79,12,0.08)',
  textPrimary: '#0D0D0C',
  textSecondary: '#5E5E5A',
  textTertiary: '#A8A8A4',
  fontSans: '"Geist", "Inter", "Helvetica Neue", system-ui, sans-serif',
  radius: 12,
  radiusSm: 7,
  radiusLg: 18,
  shadow: '0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)',
} as const;

export type D3Tokens = typeof D3;
