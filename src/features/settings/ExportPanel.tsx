import { useState } from 'react';
import { View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { ymOf } from '@/lib/format';
import { csv, planilha, type Planilha } from '@/lib/planilha';
import { Btn, Hint, Panel } from '@/ui/kit';
import { salvarArquivo } from '@/ui/exportar';
import { useToast } from '@/ui/Toast';

// Exportar para planilha (Excel, Google Planilhas): um arquivo por assunto.
export function ExportPanel() {
  const d = useData();
  const toast = useToast();
  const [busy, setBusy] = useState<Planilha | null>(null);
  const agora = new Date();
  const hoje = `${ymOf(agora)}-${String(agora.getDate()).padStart(2, '0')}`; // data local, não UTC

  const opcoes: [Planilha, string, boolean][] = [
    ['compras', `Compras (${d.tabLabel('casa')} e ${d.tabLabel('switch')})`, d.t.items.length > 0],
    ['tarefas', d.tabLabel('mudanca'), d.t.tasks.length > 0],
    ['viagens', d.tabLabel('viagem'), d.t.trip_costs.length > 0],
    ['apes', d.tabLabel('ape'), d.t.apartments.length > 0],
    ['dinheiro', 'Metas e acertos', d.t.goals.length + d.t.settlements.length > 0],
  ];

  async function exportar(tipo: Planilha) {
    setBusy(tipo);
    try {
      const rows = planilha(tipo, d.t, { tabLabel: d.tabLabel, nm: d.nm, whoLabel: w => d.whoLabel(w) });
      await salvarArquivo(`casa-a-dois-${tipo}-${hoje}.csv`, csv(rows));
      toast(rows.length > 1 ? 'Planilha pronta' : 'Planilha pronta (ainda sem linhas)', 'check');
    } catch (e: any) {
      toast(e?.message || 'Não deu para exportar.', 'x');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel title="Exportar planilha" icon="share">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {opcoes.filter(o => o[2]).map(([tipo, label]) => (
          <Btn key={tipo} label={label} kind="ghost" size="sm" icon="share" busy={busy === tipo} onPress={() => exportar(tipo)} />
        ))}
      </View>
      <Hint>Abre no Excel e no Google Planilhas. No celular, escolha onde salvar ou para quem mandar.</Hint>
    </Panel>
  );
}
