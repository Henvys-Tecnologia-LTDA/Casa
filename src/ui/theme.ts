// Identidade da Camila: papel rosado, tinta quente, coral, Jost com títulos em Cormorant itálico,
// linhas finas e botões em pílula. Cores copiadas da página. No modo escuro, o mesmo clima em
// papel escuro quente; automático pelo tema do aparelho ou escolhido nos Ajustes.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
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

const ACCENT_CLARO: Record<TabKey, string> = { casa: '#D9473F', switch: '#B83A62', ape: '#55804A', mudanca: '#A8612F', viagem: '#8C4F79', dinheiro: '#8A6512' };
const ACCENT_ESCURO: Record<TabKey, string> = { casa: '#EE6A62', switch: '#E06A92', ape: '#84B577', mudanca: '#D58A52', viagem: '#C07FAE', dinheiro: '#C9A04A' };

/* ---------- tema: automático (o do aparelho), claro ou escuro ---------- */
// A escolha fica em cada aparelho (Ajustes). C e ACCENT são sempre os mesmos objetos, com as cores
// trocadas por dentro; no celular o app redesenha tudo do zero (src/app/_layout.tsx) e, no
// navegador, a página recarrega.

export type Tema = 'auto' | 'claro' | 'escuro';
export interface EstadoTema {
  escolha: Tema;
  escuro: boolean;
  /** Sobe a cada troca de paleta (o app redesenha tudo). */
  versao: number;
  /** A escolha já foi lida do aparelho. */
  pronto: boolean;
  /** Tela em que estava quando o tema trocou, para voltar a ela. */
  volta: string;
}

const CHAVE = 'casa.tema';
const WEB = Platform.OS === 'web';

function valida(v: unknown): Tema {
  return v === 'claro' || v === 'escuro' ? v : 'auto';
}
function escolhaDoNavegador(): Tema {
  if (!WEB) return 'auto';
  try { return valida(window.localStorage.getItem(CHAVE)); } catch { return 'auto'; }
}
function calcula(escolha: Tema) {
  return escolha === 'escuro' || (escolha === 'auto' && Appearance.getColorScheme() === 'dark');
}
function pinta(escuro: boolean) {
  Object.assign(C, escuro ? ESCURO_CORES : CLARO);
  Object.assign(ACCENT, escuro ? ACCENT_ESCURO : ACCENT_CLARO);
}

const escolha0 = escolhaDoNavegador();
let estado: EstadoTema = { escolha: escolha0, escuro: calcula(escolha0), versao: 0, pronto: WEB, volta: '/' };

export const C: typeof CLARO = { ...(estado.escuro ? ESCURO_CORES : CLARO) };
export const ACCENT: Record<TabKey, string> = { ...(estado.escuro ? ACCENT_ESCURO : ACCENT_CLARO) };

const ouvintes = new Set<() => void>();
let caminho = '/';

/** A tela aberta agora (o _layout avisa), para voltar a ela depois de trocar o tema. */
export function lembrarCaminho(p: string) { caminho = p; }

function muda(patch: Partial<Pick<EstadoTema, 'escolha' | 'pronto'>>) {
  const escolha = patch.escolha ?? estado.escolha;
  const escuro = calcula(escolha);
  const trocou = escuro !== estado.escuro;
  if (trocou && WEB && typeof window !== 'undefined') { window.location.reload(); return; }
  if (trocou) pinta(escuro);
  estado = { ...estado, ...patch, escolha, escuro, ...(trocou ? { versao: estado.versao + 1, volta: caminho } : {}) };
  ouvintes.forEach(f => f());
}

// No celular, também faz o teclado, os alertas e os seletores nativos seguirem a escolha.
function sobrepoe(escolha: Tema) {
  if (WEB) return;
  try { Appearance.setColorScheme(escolha === 'auto' ? 'unspecified' : escolha === 'escuro' ? 'dark' : 'light'); } catch {}
}

/** No celular: lê a escolha guardada antes de desenhar o app (no navegador já veio do localStorage). */
export async function carregarTema() {
  if (estado.pronto) return;
  let escolha: Tema = 'auto';
  try { escolha = valida(await AsyncStorage.getItem(CHAVE)); } catch {}
  sobrepoe(escolha);
  muda({ escolha, pronto: true });
}

export function definirTema(escolha: Tema) {
  if (WEB) {
    try { window.localStorage.setItem(CHAVE, escolha); } catch {}
  } else {
    AsyncStorage.setItem(CHAVE, escolha).catch(() => {});
  }
  sobrepoe(escolha);
  muda({ escolha });
}

// No automático, segue o aparelho quando o tema dele muda com o app aberto.
Appearance.addChangeListener(() => muda({}));

const assina = (f: () => void) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; };
const agora = () => estado;
export const useTema = () => useSyncExternalStore(assina, agora, agora);

/** Para estilos e listas de cores criados fora dos componentes: refeitos quando o tema troca. */
export function porTema<T>(faz: () => T): () => T {
  let v = -1;
  let valor: T;
  return () => {
    if (v !== estado.versao) { v = estado.versao; valor = faz(); }
    return valor;
  };
}

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
