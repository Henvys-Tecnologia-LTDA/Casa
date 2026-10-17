import { useState } from 'react';
import { View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { hasPaid, sub } from '@/lib/calc';
import { dayToInput, fmtInput, inputToDay, inputToYm, money, nextYm, parsePrice, safeUrl, ymToInput } from '@/lib/format';
import type { Who } from '@/lib/types';
import { DayField, IntField, MoneyField, MonthField } from '@/ui/fields';
import { AccentCtx, Btn, Chip, ErrText, Field, Grid2, Hint, Seg, Toggle } from '@/ui/kit';
import { Sheet, Spacer } from '@/ui/Sheet';
import { ACCENT } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// Data da compra (ou hoje) mais alguns meses, no formato do campo (DD/MM/AAAA).
function somaMeses(base: string | null, meses: number) {
  const b = base ? new Date(base) : new Date();
  const d = new Date(b.getFullYear(), b.getMonth() + meses, b.getDate());
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

// "Anotar valor": quanto pagaram, quem pagou, presente, parcelas e a garantia (buyDlg da página).
export function BuySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useData();
  const { update } = useActions();
  const toast = useToast();
  const it = d.t.items.find(i => i.id === id);
  const [gift, setGift] = useState(!!it?.gift);
  const [paid, setPaid] = useState(it && hasPaid(it) ? fmtInput(it.paid) : '');
  const [payer, setPayer] = useState<Who>(it?.payer || '');
  const [parc, setParc] = useState(String(Number(it?.parcelas) || 1));
  const [start, setStart] = useState(ymToInput(it?.parc_start || nextYm(it?.bought_at)));
  const [garantia, setGarantia] = useState(dayToInput(it?.warranty_until));
  const [manual, setManual] = useState(it?.manual || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!it) return null;

  const n = Math.max(1, parseInt(parc, 10) || 1);
  const total = parsePrice(paid) || sub(it);

  async function save() {
    if (!it) return;
    const raw = paid.trim(), paidN = raw ? parsePrice(raw) : null;
    if (raw && paidN == null) { setErr('Valor inválido. Escreva algo como 199,90.'); return; }
    const nn = gift ? 1 : Math.min(48, n);
    const gar = garantia.trim() ? inputToDay(garantia) : '';
    if (garantia.trim() && !gar) { setErr('Data da garantia inválida. Use DD/MM/AAAA.'); return; }
    const man = manual.trim();
    if (man && !safeUrl(man)) { setErr('O manual precisa ser um link (https://…).'); return; }
    setBusy(true);
    try {
      await update('items', it.id, {
        gift, paid: gift ? null : paidN, payer, parcelas: nn, parc_start: nn > 1 ? (inputToYm(start) || nextYm(it.bought_at)) : '',
        warranty_until: gar || null, manual: man,
      });
      onClose();
      const eco = !gift && paidN != null ? sub(it) - paidN : gift ? sub(it) : 0;
      toast(gift ? 'Presente registrado' : eco > 0.5 ? `Economizaram ${money(eco)}!` : 'Compra registrada', eco > 0.5 ? 'heart' : 'check');
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccentCtx.Provider value={ACCENT[d.listOfItem(it) || 'casa']}>
      <Sheet visible onClose={onClose} title={it.name} footer={<>
        <Spacer />
        <Btn label="Agora não" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Toggle label="Ganhamos de presente" value={gift} onChange={setGift} />
        {!gift ? (
          <MoneyField label="Quanto pagaram no total (R$)" value={paid} onChange={setPaid} placeholder={fmtInput(sub(it)) || '0,00'}
            hint={`Previsto: ${money(sub(it))}. Deixe em branco para usar o previsto.`} autoFocus />
        ) : null}
        <Seg label="Quem pagou" value={payer} onChange={setPayer} options={[['a', d.nm('a')], ['b', d.nm('b')], ['ambos', 'Os dois']]} />
        {!gift ? (
          <Grid2>
            <IntField label="Parcelado em quantas vezes" value={parc} onChange={setParc} />
            {n > 1 ? <MonthField label="1ª parcela em" value={start} onChange={setStart} /> : null}
          </Grid2>
        ) : null}
        {!gift && n > 1 && total ? <Hint>{`${n}× de ${money(total / n)}. As parcelas aparecem no calendário da aba Dinheiro.`}</Hint> : null}
        <DayField label="Garantia até (opcional)" value={garantia} onChange={setGarantia} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6 }}>
          {([['3 meses', 3], ['1 ano', 12], ['2 anos', 24]] as const).map(([t, m]) => <Chip key={t} label={t} onPress={() => setGarantia(somaMeses(it.bought_at, m))} />)}
        </View>
        <Field label="Manual ou nota fiscal (link, opcional)" value={manual} onChangeText={setManual} placeholder="https://…" autoCapitalize="none" keyboardType="url" hint="Fica no Caderno da casa, junto com a garantia." />
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
