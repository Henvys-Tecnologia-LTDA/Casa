import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { dueInfo, PHASE, PHASES } from '@/lib/calc';
import { intFmt, pctTxt } from '@/lib/format';
import type { Phase, Task } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { Btn, CheckBox, Chip, Empty, Field, Meter, Muted, Pill, Summary, Tag, Txt, useAccent, ViewHead } from '@/ui/kit';
import { AppHeader, Loading, Screen } from '@/ui/Screen';
import { C, R } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { useSheets } from '../sheetsCtx';

export function TasksScreen() {
  const d = useData();
  const { insert } = useActions();
  const sheets = useSheets();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<Phase>('antes');
  const tasks = d.t.tasks;
  const tot = tasks.length, done = tasks.filter(t => t.done).length;
  const next = tasks.filter(t => !t.done && dueInfo(t.due)).sort((a, b) => dueInfo(a.due)!.days - dueInfo(b.due)!.days)[0];

  async function quickAdd() {
    const t = title.trim();
    if (!t) return;
    setTitle('');
    try {
      await insert('tasks', { title: t, phase });
      toast('Tarefa adicionada', 'plus');
    } catch (e: any) {
      setTitle(t);
      toast(e?.message || 'Não foi possível salvar.', 'x');
    }
  }

  const groups: [Phase, string][] = [...PHASES, ['', 'Sem etapa']];
  return (
    <Screen tab="mudanca" onFab={d.ready ? () => sheets.open({ kind: 'task', task: null }) : undefined} fabLabel="Nova tarefa">
      <AppHeader />
      <Summary cells={[
        { label: 'Tarefas', value: d.ready ? intFmt(tot) : '—' },
        { label: 'Feitas', value: d.ready ? intFmt(done) : '—', kind: 'ok', sub: tot ? pctTxt((done / tot) * 100) : undefined },
        { label: 'Faltam', value: d.ready ? intFmt(tot - done) : '—', kind: 'acc' },
        next ? { label: 'Próximo prazo', value: next.title, kind: 'txt', sub: dueInfo(next.due)!.label } : { label: 'Próximo prazo', value: '—', sub: 'nenhum prazo marcado' },
      ]} />
      {!d.ready ? <Loading /> : (
        <>
          <ViewHead title="Checklist da mudança" sub="Tudo o que não é compra, mas precisa ser feito." />
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <Field value={title} onChangeText={setTitle} placeholder="Nova tarefa…" onSubmit={quickAdd} style={{ flex: 1 }} />
              <Btn label="Adicionar" icon="plus" onPress={quickAdd} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {PHASES.map(([k, t]) => <Chip key={k} label={t} on={phase === k} onPress={() => setPhase(k)} />)}
            </View>
          </View>
          {!tasks.length ? <Empty icon="truck" title="Nenhuma tarefa ainda" text="Escrevam acima a primeira coisa que precisam resolver para a mudança." /> : null}
          {groups.map(([k, t]) => {
            const ts = tasks.filter(x => (PHASE[x.phase] ? x.phase : '') === k)
              .sort((a, b) => Number(a.done) - Number(b.done) || (dueInfo(a.due)?.days ?? 9999) - (dueInfo(b.due)?.days ?? 9999) || String(a.created_at).localeCompare(String(b.created_at)));
            if (!ts.length) return null;
            const dn = ts.filter(x => x.done).length;
            return (
              <View key={k || 'none'} style={{ gap: 10, marginTop: 4 }}>
                <GroupHead title={t} done={dn} total={ts.length} />
                <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' }}>
                  {ts.map((x, i) => <TaskRow key={x.id} t={x} first={i === 0} />)}
                </View>
              </View>
            );
          })}
        </>
      )}
    </Screen>
  );
}

export function GroupHead({ title, done, total, icon = 'flag' }: { title: string; done: number; total: number; icon?: string }) {
  const accent = useAccent();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Icon name={icon} color={accent} />
        <Txt w="medium" size={18}>{title}</Txt>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Muted size={13}>{`${done} de ${total}`}</Muted>
        <Meter ratio={total ? done / total : 0} style={{ width: 110 }} />
      </View>
    </View>
  );
}

function TaskRow({ t, first }: { t: Task; first: boolean }) {
  const d = useData();
  const { update, me } = useActions();
  const sheets = useSheets();
  const toast = useToast();
  const due = dueInfo(t.due);
  const by = t.done ? d.memberName(t.done_by) : '';

  async function toggle(val: boolean) {
    try {
      await update('tasks', t.id, { done: val, done_by: val ? me : null, done_at: val ? new Date().toISOString() : null });
      if (val) {
        const rest = d.t.tasks.filter(x => x.id !== t.id && x.phase === t.phase && !x.done).length;
        toast(t.phase && PHASE[t.phase] && !rest ? `${PHASE[t.phase]}: tudo feito!` : 'Feito!', t.phase && !rest ? 'heart' : 'check');
      }
    } catch (e: any) { toast(e?.message || 'Não foi possível salvar.', 'x'); }
  }

  return (
    <Pressable onPress={() => sheets.open({ kind: 'task', task: t })}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 12, paddingHorizontal: 14, alignItems: 'flex-start', backgroundColor: pressed ? '#FBF0EC' : C.surface, borderTopWidth: first ? 0 : 1, borderTopColor: C.line })}>
      <View style={{ paddingTop: 1 }}><CheckBox checked={t.done} onChange={toggle} label={`Feito: ${t.title}`} /></View>
      <View style={{ flex: 1, gap: 5 }}>
        <Txt w="semibold" size={15.5} color={t.done ? C.muted : C.ink} style={t.done ? { textDecorationLine: 'line-through' } : undefined}>{t.title}</Txt>
        {(d.whoLabel(t.who) || (due && !t.done) || by) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {d.whoLabel(t.who) ? <Tag label={d.whoLabel(t.who)} icon="users" /> : null}
            {due && !t.done ? <Pill label={due.label} kind={due.cls} icon="calendar" /> : null}
            {by ? <Txt w="semibold" size={13} color={C.ok}>por {by}</Txt> : null}
          </View>
        ) : null}
        {t.notes ? <Muted size={13.5}>{t.notes}</Muted> : null}
      </View>
    </Pressable>
  );
}
