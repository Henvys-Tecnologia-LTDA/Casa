// Identidade da Camila: papel rosado, tinta quente, coral, Jost com títulos em Cormorant itálico,
// linhas finas e botões em pílula. Cores copiadas da página.

export const C = {
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
};

export type TabKey = 'casa' | 'switch' | 'ape' | 'mudanca' | 'viagem' | 'dinheiro';

export const ACCENT: Record<TabKey, string> = {
  casa: '#D9473F',
  switch: '#B83A62',
  ape: '#55804A',
  mudanca: '#A8612F',
  viagem: '#8C4F79',
  dinheiro: '#8A6512',
};

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

export const soft = (accent: string) => mix(accent, 14);

export const R = { card: 3, input: 4, icon: 8, pill: 999 };
