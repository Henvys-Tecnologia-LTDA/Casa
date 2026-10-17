import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { hostOf, normLink, safeUrl } from '@/lib/format';
import { diasDaViagem, lerHora, roteiroPorDia } from '@/lib/roteiro';
import type { Trip, TripPlan } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { AccentCtx, Btn, Chip, ErrText, Field, Grid2, Label, Muted, Panel, Txt } from '@/ui/kit';
import { Photo } from '@/ui/Photo';
import { PhotoZone, usePhotoDraft } from '@/ui/PhotoZone';
import { Sheet, Spacer, useConfirm } from '@/ui/Sheet';
import { ACCENT, C, R } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { useApagar } from '@/ui/useApagar';

import { useSheets } from '../sheetsCtx';

// Roteiro da viagem dia a dia. Só aparecem os dias que já têm algo, para a tela não encher de dias vazios.

export function RoteiroPanel({ t }: { t: Trip }) {
  const d = useData();
  const sheets = useSheets();
  const plans = d.t.trip_plans.filter(p => p.trip_id === t.id);
  const grupos = roteiroPorDia(t, plans);
  const novo = () => sheets.open({ kind: 'plan', tripId: t.id, plan: null });
  return (
    <Panel title="Roteiro" icon="map">
      {grupos.length ? grupos.map(g => (
        <View key={g.key} style={{ gap: 6 }}>
          <Label>{g.label}</Label>
          <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' }}>
            {g.itens.map((p, i) => <Linha key={p.id} p={p} first={i === 0} />)}
          </View>
        </View>
      )) : <Muted size={12.5}>Nada planejado ainda. Anotem passeios, restaurantes e reservas de cada dia, com o link ou o print da reserva.</Muted>}
      <View style={{ alignSelf: 'flex-start' }}><Btn label="Adicionar ao roteiro" kind="ghost" size="sm" icon="plus" onPress={novo} /></View>
    </Panel>
  );
}

function Linha({ p, first }: { p: TripPlan; first: boolean }) {
  const sheets = useSheets();
  const url = safeUrl(p.link);
  return (
    <Pressable onPress={() => sheets.open({ kind: 'plan', tripId: p.trip_id, plan: p })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderTopWidth: first ? 0 : 1, borderTopColor: C.line, backgroundColor: pressed ? C.pressed : C.surface })}>
      <Txt w="semibold" size={13.5} color={p.hour ? C.ink : C.muted} style={{ width: 46 }}>{p.hour || '—'}</Txt>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt size={14.5}>{p.text}</Txt>
        {url ? (
          <Pressable onPress={() => Linking.openURL(url)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 3, alignSelf: 'flex-start' }}>
            <Txt w="semibold" size={12.5} color={ACCENT.viagem}>{hostOf(url) || 'Abrir link'}</Txt>
            <Icon name="ext" size={12} color={ACCENT.viagem} />
          </Pressable>
        ) : null}
      </View>
      {p.image ? <Photo path={p.image} style={{ width: 44, height: 44, borderRadius: R.icon }} /> : null}
    </Pressable>
  );
}

export function PlanSheet({ tripId, plan, onClose }: { tripId: string; plan: TripPlan | null; onClose: () => void }) {
  const d = useData();
  const { insert, update, hid } = useActions();
  const apagar = useApagar();
  const toast = useToast();
  const confirm = useConfirm();
  const t = d.t.trips.find(x => x.id === tripId);
  const dias = t ? diasDaViagem(t) : [];
  const photo = usePhotoDraft(plan?.image || '');
  const [day, setDay] = useState<string | null>(plan ? plan.day : dias[0]?.iso ?? null);
  const [hour, setHour] = useState(plan?.hour || '');
  const [text, setText] = useState(plan?.text || '');
  const [link, setLink] = useState(plan?.link || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const tx = text.trim();
    if (!tx) { setErr('Escreva o que vão fazer.'); return; }
    const h = lerHora(hour);
    if (h == null) { setErr('Horário inválido. Use algo como 9:30.'); return; }
    const l = link.trim() ? normLink(link) : '';
    if (link.trim() && !l) { setErr('O link não parece um endereço de site.'); return; }
    setBusy(true);
    try {
      const image = await photo.result(hid);
      const data: Partial<TripPlan> = { trip_id: tripId, day, hour: h, text: tx, link: l, image };
      if (plan) await update('trip_plans', plan.id, data); else await insert('trip_plans', data);
      onClose();
      toast(plan ? 'Roteiro salvo' : 'No roteiro', 'map');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  async function del() {
    if (!plan) return;
    const ok = await confirm({ title: 'Tirar do roteiro?', text: `“${plan.text}” sai do roteiro de vocês dois.`, yes: 'Tirar' });
    if (!ok) return;
    try { await apagar('trip_plans', plan.id, 'Saiu do roteiro', [plan.image]); onClose(); } catch (e: any) { setErr(e?.message || ''); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.viagem}>
      <Sheet visible onClose={onClose} title={plan ? 'Editar roteiro' : 'Adicionar ao roteiro'} footer={<>
        {plan ? <Btn label="Tirar" kind="danger" icon="trash" onPress={del} /> : null}
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Field label="O que vão fazer" value={text} onChangeText={setText} placeholder="Ex.: Torre de Belém, jantar no Time Out" autoFocus={!plan} maxLength={300} />
        {dias.length ? (
          <View style={{ gap: 6 }}>
            <Txt w="semibold" size={12.5} color={C.muted}>Dia</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {dias.map((x, i) => <Chip key={x.iso} label={`${i + 1} · ${x.curto}`} on={day === x.iso} onPress={() => setDay(x.iso)} />)}
              <Chip label="Sem dia" on={!day} onPress={() => setDay(null)} />
            </View>
          </View>
        ) : <Muted size={12.5}>Com as datas da viagem preenchidas, dá para escolher o dia.</Muted>}
        <Grid2>
          <Field label="Horário (opcional)" value={hour} onChangeText={setHour} placeholder="Ex.: 9:30" keyboardType="numbers-and-punctuation" maxLength={5} />
          <Field label="Link da reserva (opcional)" value={link} onChangeText={setLink} placeholder="https://" autoCapitalize="none" keyboardType="url" />
        </Grid2>
        <PhotoZone draft={photo} icon="ticket" hint="Print da reserva, do ingresso ou do voo (opcional)." />
        <ErrText msg={err || photo.err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
