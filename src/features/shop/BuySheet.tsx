import { useState } from 'react';

import { useActions, useData } from '@/data/DataProvider';
import { hasPaid, sub } from '@/lib/calc';
import { fmtInput, inputToYm, money, nextYm, parsePrice, ymToInput } from '@/lib/format';
import type { Who } from '@/lib/types';
import { IntField, MoneyField, MonthField } from '@/ui/fields';
import { AccentCtx, Btn, ErrText, Grid2, Hint, Seg, Toggle } from '@/ui/kit';
import { Sheet, Spacer } from '@/ui/Sheet';
import { ACCENT } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// "Anotar valor": quanto pagaram, quem pagou, presente e parcelas (buyDlg da página).
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
    setBusy(true);
    try {
      await update('items', it.id, {
        gift, paid: gift ? null : paidN, payer, parcelas: nn, parc_start: nn > 1 ? (inputToYm(start) || nextYm(it.bought_at)) : '',
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
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
