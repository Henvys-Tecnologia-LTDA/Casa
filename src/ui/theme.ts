// Identidade da Camila: papel rosado, tinta quente, coral, Jost com títulos em Cormorant itálico,
// linhas finas e botões em pílula. Cores copiadas da página. No modo escuro, o mesmo clima em
// papel escuro quente; a paleta é escolhida quando o app abre, pelo tema do aparelho.
import { Appearance, Platform } from 'react-native';

import type { TabKey } from '@/lib/types';

export type { TabKey };

const CLARO = {
  bg: '#FBF1EF',
  surface: '#FFFAF8',
  sunken: '#F3E4E0',
  ink: '#2A2320',
  muted: '#6C655B',
  line: '#EAD9D4',
  coral: '#E2504F',
  heart: '#E2504F',
  ok: '#4F7D44',
  okSoft: '#E5EEDF',
  hi: '#A63A22',
  hiSoft: '#F7DFD7',
  mid: '#8C6410',
  midSoft: '#F4E7CB',
  lo: '#6C655B',
  loSoft: '#F0E4E0',
  s1: '#2a78d6',
  s2: '#eb6834',
  s3: '#1baf7a',
  s4: '#eda100',
  grid: '#EBDDD9',
  axis: '#D3C2BD',
  placeholder: '#A39A90',
  pressed: '#FBF0EC',
  backdrop: 'rgba(20,14,12,0.45)',
  shadow: '#2A2320',
};

const ESCURO_CORES: typeof CLARO = {
  bg: '#1C1715',
  surface: '#262020',
  sunken: '#2F2826',
  ink: '#F3E9E5',
  muted: '#B3A79F',
  line: '#3D3431',
  coral: '#F0706B',
  heart: '#F0706B',
  ok: '#8DC07F',
  okSoft: '#24321F',
  hi: '#F08F72',
  hiSoft: '#3D2620',
  mid: '#E0B35A',
  midSoft: '#3A2F17',
  lo: '#B3A79F',
  loSoft: '#2F2826',
  s1: '#5B9BEA',
  s2: '#F28A5C',
  s3: '#3CC892',
  s4: '#F2B937',
  grid: '#3A312E',
  axis: '#5A4E4A',
  placeholder: '#7E726B',
  pressed: '#302826',
  backdrop: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
};

// As duas paletas, para o que desenha os dois temas de uma vez (o widget da tela de início).
export const PALETA = { claro: CLARO, escuro: ESCURO_CORES };

export const ESCURO = Appearance.getColorScheme() === 'dark';
export const C = ESCURO ? ESCURO_CORES : CLARO;

// No navegador, se o tema do sistema mudar com o site aberto, recarrega para aplicar a outra paleta.
if (Platform.OS === 'web') {
  Appearance.addChangeListener(({ colorScheme }) => {
    if ((colorScheme === 'dark') !== ESCURO && typeof window !== 'undefined') window.location.reload();
  });
}

export const ACCENT: Record<TabKey, string> = ESCURO
  ? { casa: '#EE6A62', switch: '#E06A92', ape: '#84B577', mudanca: '#D58A52', viagem: '#C07FAE', dinheiro: '#C9A04A' }
  : { casa: '#D9473F', switch: '#B83A62', ape: '#55804A', mudanca: '#A8612F', viagem: '#8C4F79', dinheiro: '#8A6512' };

export const F = {
  light: 'Jost_300Light',
  regular: 'Jost_400Regular',
  medium: 'Jost_500Medium',
  semibold: 'Jost_600SemiBold',
  serif: 'CormorantGaramond_600SemiBold_Italic',
  serifMedium: 'CormorantGaramond_500Medium_Italic',
};

// color-mix(in srgb, cor X%, surface) da página.
export function mix(hex: string, pct: number, base = C.surface): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(base);
  const c = a.map((v, i) => Math.round(v * (pct / 100) + b[i] * (1 - pct / 100)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}

/** A cor com transparência (rgba), para camadas por cima de outra cor. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

export const soft = (accent: string) => mix(accent, 14);

export const R = { card: 3, input: 4, icon: 8, pill: 999 };
