import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { goalCalc, simulate } from '@/lib/calc';
import { diffM, fmtInput, inputToYm, money, parsePrice, plural, ymOf, ymToInput } from '@/lib/format';
import type { Goal, GoalDeposit } from '@/lib/types';
import { MoneyField, MonthField } from '@/ui/fields';
import { AccentCtx, Btn, ErrText, Field, Grid2, Hint, Seg } from '@/ui/kit';
import { Sheet, Spacer, useConfirm } from '@/ui/Sheet';
import { ACCENT } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

export function GoalSheet({ goal, onClose }: { goal: Goal | null; onClose: () => void }) {
  const d = useData();
  const { insert, update, remove } = useActions();
  const toast = useToast();
  const confirm = useConfirm();
  const [name, setName] = useState(goal?.name || '');
  const [target, setTarget] = useState(goal?.target ? fmtInput(goal.target) : '');
  const [deadline, setDeadline] = useState(ymToInput(goal?.deadline || ''));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const f = d.fav, fs = f ? simulate(f) : null;

  const t = parsePrice(target) || 0, dl = inputToYm(deadline);
  const months = dl ? Math.max(0, diffM(ymOf(null), dl) + 1) : 0;
  const saved = goal ? goalCalc(goal, d.goalDeps(goal.id)).saved : 0, left = Math.max(0, t - saved);

  async function save() {
    const nm = name.trim();
    if (!nm) { setErr('Dê um nome à meta.'); return; }
    const tg = target.trim() ? parsePrice(target) : 0;
    if (tg == null) { setErr('Valor inválido. Escreva algo como 90.000.'); return; }
    if (deadline.trim() && !dl) { setErr('Prazo inválido. Use MM/AAAA.'); return; }
    setBusy(true);
    try {
      if (goal) await update('goals', goal.id, { name: nm, target: tg, deadline: dl });
      else await insert('goals', { name: nm, target: tg, deadline: dl });
      onClose();
      toast(goal ? 'Meta salva' : 'Meta criada', goal ? 'check' : 'plus');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }
  async function del() {
    if (!goal) return;
    const ok = await confirm({ title: `Excluir a meta “${goal.name}”?`, text: 'O histórico de valores guardados nela também some.', yes: 'Excluir meta' });
    if (!ok) return;
    try { await remove('goals', goal.id); onClose(); toast('Meta excluída', 'trash'); } catch (e: any) { setErr(e?.message || ''); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.dinheiro}>
      <Sheet visible onClose={onClose} title={goal ? 'Editar meta' : 'Nova meta'} footer={<>
        {goal ? <Btn label="Excluir" kind="danger" icon="trash" onPress={del} /> : null}
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Field label="Para que é" value={name} onChangeText={setName} placeholder="Ex.: Entrada do apê, reserva de emergência" autoFocus={!goal} />
        <Grid2>
          <MoneyField label="Quanto querem juntar (R$)" value={target} onChange={setTarget} placeholder="Ex.: 90.000" />
          <MonthField label="Até quando" value={deadline} onChange={setDeadline} />
        </Grid2>
        {fs && fs.cash > 0 ? (
          <View style={{ alignSelf: 'flex-start' }}>
            <Btn label="Usar o que o apê favorito pede na mão" kind="ghost" size="sm" icon="building" onPress={() => {
              setTarget(fmtInput(fs.parcelada ? fs.custos : fs.cash));
              if (!name.trim()) setName(fs.parcelada ? 'ITBI e cartório do apê' : 'Entrada do apê');
            }} />
          </View>
        ) : null}
        {t && months ? <Hint>{`Para chegar lá: ${money(left / months)} por mês durante ${plural(months, 'mês', 'meses')}${saved ? ` (já têm ${money(saved)})` : ''}`}</Hint> : null}
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}

export function DepositSheet({ goalId, onClose }: { goalId: string; onClose: () => void }) {
  const d = useData();
  const { insert, me } = useActions();
  const toast = useToast();
  const g = d.t.goals.find(x => x.id === goalId);
  const [type, setType] = useState<'in' | 'out'>('in');
  const [amt, setAmt] = useState('');
  const [who, setWho] = useState<GoalDeposit['who']>('ambos');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('casa.quem').then(v => { if (v === 'a' || v === 'b' || v === 'ambos') setWho(v); }).catch(() => {});
  }, []);

  if (!g) return null;

  async function save() {
    if (!g) return;
    const v = parsePrice(amt);
    if (!v) { setErr('Escreva um valor, como 300 ou 1.200,00.'); return; }
    AsyncStorage.setItem('casa.quem', who).catch(() => {});
    const amount = type === 'out' ? -v : v;
    setBusy(true);
    try {
      await insert('goal_deposits', { goal_id: g.id, amount, who, by_user: me });
      onClose();
      const after = goalCalc(g, [...d.goalDeps(g.id), { amount } as GoalDeposit]);
      toast(type === 'in' && after.target && after.left <= 0 ? `Meta “${g.name}” alcançada!` : type === 'out' ? `${money(v)} retirados` : `${money(v)} guardados`, type === 'out' ? 'undo' : 'heart');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.dinheiro}>
      <Sheet visible onClose={onClose} title={g.name || 'Guardar'} footer={<>
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Seg label="Movimento" value={type} onChange={setType} options={[['in', 'Guardar'], ['out', 'Tirar']]} />
        <MoneyField label="Valor (R$)" value={amt} onChange={setAmt} autoFocus />
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {[100, 500, 1000].map(v => <Btn key={v} label={money(v).replace(',00', '')} kind="ghost" size="xs" onPress={() => setAmt(fmtInput(v))} />)}
        </View>
        <Seg label="Quem guardou" value={who} onChange={setWho} options={[['a', d.nm('a')], ['b', d.nm('b')], ['ambos', 'Os dois']]} />
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
