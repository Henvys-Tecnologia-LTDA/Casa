import { useActions, useData } from '@/data/DataProvider';
import { stats, TABS } from '@/lib/calc';
import type { Item } from '@/lib/types';
import { useToast } from '@/ui/Toast';

import { useSheets } from '../sheetsCtx';

// Marcar item como comprado (com o aviso "Anotar valor"), como setBought() da página.
export function useShopOps() {
  const { update, me } = useActions();
  const d = useData();
  const toast = useToast();
  const sheets = useSheets();

  async function setBought(it: Item, val: boolean) {
    const patch: Partial<Item> = { bought: val, bought_by: val ? me : null, bought_at: val ? new Date().toISOString() : null };
    try {
      await update('items', it.id, patch);
      if (!val) { toast('Voltou para a lista', 'undo'); return; }
      const sec = d.secById(it.section_id);
      const st = stats(d.itemsOf(it.section_id).map(x => (x.id === it.id ? { ...x, ...patch } : x)));
      const act = { label: 'Anotar valor', fn: () => sheets.open({ kind: 'buy', id: it.id }) };
      if (sec && st.count && st.nb === st.count) toast(`${sec.name} ${TABS[sec.list]?.done || 'completo'}! Tudo comprado`, 'heart', act);
      else toast('Comprado!', 'check', act);
    } catch (e: any) {
      toast(e?.message || 'Não foi possível salvar.', 'x');
    }
  }

  return { setBought };
}
