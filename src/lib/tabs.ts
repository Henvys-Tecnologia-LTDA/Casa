import type { Household, TabKey } from './types';

// Abas do app: cada casal pode renomear, trocar o ícone ou esconder (salvo em households.tabs).

export const TAB_ORDER: TabKey[] = ['casa', 'switch', 'ape', 'mudanca', 'viagem', 'dinheiro'];

export const TAB_DEFAULTS: Record<TabKey, { label: string; icon: string }> = {
  casa: { label: 'Casa', icon: 'house' },
  switch: { label: 'Console', icon: 'gamepad' },
  ape: { label: 'Apê', icon: 'building' },
  mudanca: { label: 'Mudança', icon: 'truck' },
  viagem: { label: 'Viagem', icon: 'suitcase' },
  dinheiro: { label: 'Dinheiro', icon: 'wallet' },
};

export const TAB_HINT: Record<TabKey, string> = {
  casa: 'Compras da casa por cômodo',
  switch: 'Videogame, jogos e acessórios (ou outra lista de compras)',
  ape: 'Simulador de financiamento do apê',
  mudanca: 'Checklist da mudança',
  viagem: 'Custos, cofrinho e mala das viagens',
  dinheiro: 'Metas e calendário de parcelas',
};

export const TAB_ICON_CHOICES = [
  'house', 'sofa', 'pot', 'bed', 'gamepad', 'switch', 'joycon', 'ticket', 'desk', 'plant',
  'building', 'truck', 'box', 'suitcase', 'plane', 'camera', 'wallet', 'heart', 'gift', 'star', 'trophy', 'calendar',
];

export interface TabInfo { key: TabKey; label: string; icon: string; hidden: boolean }

export function resolveTabs(h: Pick<Household, 'tabs'> | null | undefined): Record<TabKey, TabInfo> {
  const cfg = (h?.tabs && typeof h.tabs === 'object' ? h.tabs : {}) as Household['tabs'];
  const out = {} as Record<TabKey, TabInfo>;
  for (const k of TAB_ORDER) {
    const c = cfg[k] || {};
    out[k] = {
      key: k,
      label: String(c.label || '').trim() || TAB_DEFAULTS[k].label,
      icon: c.icon || TAB_DEFAULTS[k].icon,
      hidden: !!c.hidden,
    };
  }
  if (TAB_ORDER.every(k => out[k].hidden)) out.casa.hidden = false; // sempre sobra uma aba
  return out;
}

export const firstVisibleTab = (tabs: Record<TabKey, TabInfo>) => TAB_ORDER.find(k => !tabs[k].hidden) || 'casa';
