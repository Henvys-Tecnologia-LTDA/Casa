import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { CAT, CATS, TSTATUS } from '@/lib/calc';
import { dayToInput, fmtInput, inputToDay, inputToYm, money, nextYm, parsePrice, ymToInput } from '@/lib/format';
import type { Trip, TripCost } from '@/lib/types';
import { DayField, IntField, MoneyField, MonthField } from '@/ui/fields';
import { AccentCtx, Btn, Chip, ErrText, Field, Grid2, Hint, Toggle, Txt } from '@/ui/kit';
import { deletePhotos } from '@/ui/Photo';
import { PhotoZone, usePhotoDraft } from '@/ui/PhotoZone';
import { Sheet, Spacer, useConfirm } from '@/ui/Sheet';
import { ACCENT, C } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

export function TripSheet({ trip, onClose }: { trip: Trip | null; onClose: () => void }) {
  const { insert, update, remove, hid } = useActions();
  const toast = useToast();
  const confirm = useConfirm();
  const t = trip;
  const [name, setName] = useState(t?.name || '');
  const [dest, setDest] = useState(t?.destination || '');
  const [start, setStart] = useState(dayToInput(t?.start_date));
  const [end, setEnd] = useState(dayToInput(t?.end_date));
  const [status, setStatus] = useState<Trip['status']>(t?.status || 'planejando');
  const [people, setPeople] = useState(String(t?.people || 2));
  const [notes, setNotes] = useState(t?.notes || '');
  const photo = usePhotoDraft(t?.image || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const nm = name.trim();
    if (!nm) { setErr('Dê um nome à viagem.'); return; }
    const s = start.trim() ? inputToDay(start) : '', e = end.trim() ? inputToDay(end) : '';
    if ((start.trim() && !s) || (end.trim() && !e)) { setErr('Data inválida. Use DD/MM/AAAA.'); return; }
    if (s && e && e < s) { setErr('A volta está antes da ida. Confira as datas.'); return; }
    setBusy(true); setErr('');
    try {
      const image = await photo.result(hid);
      const data: Partial<Trip> = {
        name: nm, destination: dest.trim(), start_date: s || null, end_date: e || null, status,
        people: Math.min(50, Math.max(1, parseInt(people, 10) || 2)), notes: notes.trim(), image,
      };
      if (t) {
        await update('trips', t.id, data);
        if (t.image && t.image !== image) deletePhotos([t.image]);
        onClose();
        toast('Viagem salva');
      } else {
        const row = await insert('trips', { ...data, likes: [] });
        onClose();
        router.push({ pathname: '/trip/[id]', params: { id: row.id } });
        toast('Viagem adicionada', 'plus');
      }
    } catch (e2: any) { setErr(e2?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  async function del() {
    if (!t) return;
    const ok = await confirm({ title: `Excluir ${t.name || 'esta viagem'}?`, text: 'Custos, cofrinho e mala desta viagem saem da lista de vocês dois.', yes: 'Excluir viagem' });
    if (!ok) return;
    try {
      await remove('trips', t.id);
      deletePhotos([t.image]);
      onClose();
      if (router.canGoBack()) router.back();
      toast('Viagem excluída', 'trash');
    } catch (e: any) { setErr(e?.message || ''); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.viagem}>
      <Sheet visible onClose={onClose} title={t ? 'Editar viagem' : 'Nova viagem'} footer={<>
        {t ? <Btn label="Excluir" kind="danger" icon="trash" onPress={del} /> : null}
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label={busy ? 'Salvando…' : 'Salvar'} onPress={save} busy={busy} />
      </>}>
        <PhotoZone draft={photo} icon="suitcase" hint="Foto do destino: escolha da galeria ou tire com a câmera." />
        <Field label="Nome da viagem" value={name} onChangeText={setName} placeholder="Ex.: Lua de mel" autoFocus={!t} />
        <Field label="Destino" value={dest} onChangeText={setDest} placeholder="Ex.: Porto de Galinhas, PE" />
        <Grid2>
          <DayField label="Ida" value={start} onChange={setStart} />
          <DayField label="Volta" value={end} onChange={setEnd} />
        </Grid2>
        <View style={{ gap: 6 }}>
          <Txt w="semibold" size={12.5} color={C.muted}>Situação</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {TSTATUS.map(([k, l]) => <Chip key={k} label={l} on={status === k} onPress={() => setStatus(k)} />)}
          </View>
        </View>
        <IntField label="Quantas pessoas" value={people} onChange={setPeople} />
        <Field label="Observações" value={notes} onChangeText={setNotes} placeholder="Ideias de passeios, restaurantes, dicas…" multiline />
        <ErrText msg={err || photo.err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}

export function CostSheet({ tripId, cost, onClose }: { tripId: string; cost: TripCost | null; onClose: () => void }) {
  const d = useData();
  const { insert, update, remove } = useActions();
  const toast = useToast();
  const confirm = useConfirm();
  const trip = d.t.trips.find(x => x.id === tripId);
  const [descr, setDescr] = useState(cost?.descr || '');
  const [cat, setCat] = useState(cost && CAT[cost.cat] ? cost.cat : 'passagens');
  const [amount, setAmount] = useState(cost ? fmtInput(cost.amount) : '');
  const [parc, setParc] = useState(String(cost?.parcelas || 1));
  const [paid, setPaid] = useState(!!cost?.paid);
  const [start, setStart] = useState(ymToInput(cost?.parc_start || nextYm(cost ? trip?.created_at : null)));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const v = parsePrice(amount), n = Math.max(1, parseInt(parc, 10) || 1);

  async function save() {
    if (!v) { setErr('Informe o valor, como 1.200,00.'); return; }
    const nn = Math.min(48, n);
    const data: Partial<TripCost> = {
      descr: descr.trim(), cat, amount: v, parcelas: nn, paid, parc_start: nn > 1 ? (inputToYm(start) || nextYm(Date.now())) : '',
    };
    setBusy(true);
    try {
      if (cost) await update('trip_costs', cost.id, data); else await insert('trip_costs', { ...data, trip_id: tripId });
      onClose();
      toast(cost ? 'Custo salvo' : 'Custo adicionado', cost ? 'check' : 'plus');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  async function del() {
    if (!cost) return;
    const ok = await confirm({ title: `Excluir “${cost.descr || CAT[cost.cat]?.t || 'custo'}”?`, text: 'O custo sai do total da viagem.', yes: 'Excluir custo' });
    if (!ok) return;
    try { await remove('trip_costs', cost.id); onClose(); toast('Custo excluído', 'trash'); } catch (e: any) { setErr(e?.message || ''); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.viagem}>
      <Sheet visible onClose={onClose} title={cost ? 'Editar custo' : 'Novo custo'} footer={<>
        {cost ? <Btn label="Excluir" kind="danger" icon="trash" onPress={del} /> : null}
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Field label="O que é" value={descr} onChangeText={setDescr} placeholder="Ex.: Passagens ida e volta" autoFocus={!cost} />
        <View style={{ gap: 6 }}>
          <Txt w="semibold" size={12.5} color={C.muted}>Categoria</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {CATS.map(([k, l, ic]) => <Chip key={k} label={l} icon={ic} on={cat === k} onPress={() => setCat(k)} />)}
          </View>
        </View>
        <MoneyField label="Valor total (R$)" value={amount} onChange={setAmount} />
        <Grid2>
          <IntField label="Parcelas no cartão" value={parc} onChange={setParc} />
          {n > 1 ? <MonthField label="1ª parcela em" value={start} onChange={setStart} /> : null}
        </Grid2>
        <Toggle label="Já pago" value={paid} onChange={setPaid} />
        {v ? <Hint>{n > 1 ? `${n}× de ${money(v / n)}` : `À vista: ${money(v)}`}</Hint> : null}
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
