import { useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { agenda, dueInfo, PHASE, PHASES } from '@/lib/calc';
import { textoTarefas } from '@/lib/compartilhar';
import { dayLabel, intFmt, pctTxt } from '@/lib/format';
import { CHECKLIST_MUDANCA } from '@/lib/modelos';
import { colunaDe, COLUNAS, concluirRepetida, passosTxt, REPEAT_L, type Coluna } from '@/lib/tarefas';
import type { Phase, Task } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { Btn, CheckBox, Chip, Empty, Field, IconBtn, Meter, Muted, Pill, Seg, Summary, Tag, Txt, useAccent, ViewHead } from '@/ui/kit';
import { AppHeader, Loading, Screen } from '@/ui/Screen';
import { compartilhar } from '@/ui/share';
import { C, R } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { useComentarios } from '../conversa/Conversa';
import { useSheets } from '../sheetsCtx';
import { AtalhoCaderno } from '../caderno/Caderno';

type Modo = 'lista' | 'quadro';

export function TasksScreen() {
  const d = useData();
  const { insert } = useActions();
  const sheets = useSheets();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [phase, setPhase] = useState<Phase>('antes');
  const [modo, setModo] = useState<Modo>('lista');
  const tasks = d.t.tasks;
  const unicas = tasks.filter(t => !t.repeat);
  const rotina = tasks.filter(t => t.repeat);
  const tot = unicas.length, done = unicas.filter(t => t.done).length;
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

  async function usarModelo() {
    try {
      for (const [t, p] of CHECKLIST_MUDANCA) await insert('tasks', { title: t, phase: p });
      toast('Checklist pronto adicionado', 'check');
    } catch (e: any) { toast(e?.message || 'Não foi possível salvar.', 'x'); }
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
          <AtalhoCaderno />
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <ViewHead title="Checklist da mudança" sub="Tudo o que não é compra, mas precisa ser feito." style={{ flexShrink: 1 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {tasks.length ? <Seg value={modo} onChange={setModo} options={[['lista', 'Lista'], ['quadro', 'Quadro']]} /> : null}
              {tot - done > 0 ? <Btn label="Mandar" kind="ghost" size="sm" icon="share" onPress={() => compartilhar(textoTarefas(d.tabLabel('mudanca'), tasks))} /> : null}
            </View>
          </View>
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
              <Field value={title} onChangeText={setTitle} placeholder="Nova tarefa…" onSubmit={quickAdd} style={{ flex: 1 }} />
              <Btn label="Adicionar" icon="plus" onPress={quickAdd} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {PHASES.map(([k, t]) => <Chip key={k} label={t} on={phase === k} onPress={() => setPhase(k)} />)}
            </View>
          </View>
          {!tasks.length ? (
            <Empty icon="truck" title="Nenhuma tarefa ainda" text="Escrevam acima a primeira coisa que precisam resolver, ou comecem pelo checklist pronto."
              action={<Btn label={`Usar o checklist pronto (${CHECKLIST_MUDANCA.length})`} kind="ghost" icon="check" onPress={usarModelo} />} />
          ) : null}
          {modo === 'quadro' ? <Quadro tasks={tasks} /> : (
            <>
              <Agenda tasks={tasks} />
              {groups.map(([k, t]) => {
                const ts = unicas.filter(x => (PHASE[x.phase] ? x.phase : '') === k)
                  .sort((a, b) => Number(a.done) - Number(b.done) || Number(b.doing) - Number(a.doing) || (dueInfo(a.due)?.days ?? 9999) - (dueInfo(b.due)?.days ?? 9999) || String(a.created_at).localeCompare(String(b.created_at)));
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
              {rotina.length ? (
                <View style={{ gap: 10, marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Icon name="repeat" color={C.muted} />
                    <Txt w="medium" size={18}>Rotina da casa</Txt>
                  </View>
                  <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' }}>
                    {[...rotina].sort((a, b) => String(a.due ?? '').localeCompare(String(b.due ?? ''))).map((x, i) => <TaskRow key={x.id} t={x} first={i === 0} />)}
                  </View>
                </View>
              ) : null}
            </>
          )}
        </>
      )}
    </Screen>
  );
}

// O que tem prazo agora, antes das etapas. Às 9h quem tem avisos ligados recebe o lembrete do dia.
function Agenda({ tasks }: { tasks: Task[] }) {
  const accent = useAccent();
  const ag = agenda(tasks);
  const parts: [string, Task[], string, string][] = [
    ['Atrasadas', ag.atrasadas, 'alert', C.hi], ['Hoje', ag.hoje, 'calendar', accent], ['Próximos 7 dias', ag.semana, 'calendar', C.muted],
  ];
  if (!parts.some(p => p[1].length)) return null;
  return (
    <View style={{ gap: 12, marginTop: 4 }}>
      <ViewHead title="Agenda" sub="O que tem prazo agora. Às 9h, quem ligou os avisos recebe o lembrete do dia." />
      {parts.map(([title, ts, icon, color]) => (ts.length ? (
        <View key={title} style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={icon} size={16} color={color} />
            <Txt w="medium" size={15.5} color={title === 'Atrasadas' ? C.hi : C.ink}>{title}</Txt>
            <Muted size={13}>{String(ts.length)}</Muted>
          </View>
          <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: title === 'Atrasadas' ? C.hiSoft : C.line, borderRadius: R.card, overflow: 'hidden' }}>
            {ts.map((x, i) => <TaskRow key={x.id} t={x} first={i === 0} />)}
          </View>
        </View>
      ) : null))}
    </View>
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

/** Marcar como feita (ou mover no quadro). A que se repete fica aberta para a próxima vez, com "Desfazer". */
function useMoverTarefa() {
  const d = useData();
  const { update, me } = useActions();
  const toast = useToast();
  return async (t: Task, col: Coluna) => {
    try {
      if (col === 'feito' && t.repeat) {
        const antes: Partial<Task> = { due: t.due, who: t.who, steps: t.steps, doing: t.doing, last_done_at: t.last_done_at, last_done_by: t.last_done_by };
        const patch = concluirRepetida(t, me);
        await update('tasks', t.id, patch);
        const quem = d.whoLabel(patch.who);
        toast(`Feito! Próxima: ${dayLabel(patch.due)}${quem ? ` (${quem})` : ''}`, 'repeat', {
          label: 'Desfazer',
          fn: () => { update('tasks', t.id, antes).catch(() => {}); },
        });
        return;
      }
      const val = col === 'feito';
      await update('tasks', t.id, { done: val, doing: col === 'fazendo', done_by: val ? me : null, done_at: val ? new Date().toISOString() : null });
      if (val) {
        const rest = d.t.tasks.filter(x => x.id !== t.id && x.phase === t.phase && !x.done && !x.repeat).length;
        toast(t.phase && PHASE[t.phase] && !rest ? `${PHASE[t.phase]}: tudo feito!` : 'Feito!', t.phase && !rest ? 'heart' : 'check');
      }
    } catch (e: any) { toast(e?.message || 'Não foi possível salvar.', 'x'); }
  };
}

/** Os detalhes pequenos de uma tarefa: quem, prazo, passos, repetição e comentários. */
function Detalhes({ t }: { t: Task }) {
  const d = useData();
  const due = dueInfo(t.due);
  const by = t.done ? d.memberName(t.done_by) : '';
  const passos = passosTxt(t);
  const nCom = useComentarios(t.id);
  const tem = d.whoLabel(t.who) || (due && !t.done) || by || passos || t.repeat || nCom || (t.doing && !t.done);
  if (!tem) return null;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      {t.doing && !t.done ? <Pill label="Fazendo" kind="acc" /> : null}
      {d.whoLabel(t.who) ? <Tag label={d.whoLabel(t.who)} icon="users" /> : null}
      {due && !t.done ? <Pill label={due.label} kind={due.cls} icon="calendar" /> : null}
      {t.repeat ? <Tag label={REPEAT_L[t.repeat]} icon="repeat" /> : null}
      {passos ? <Tag label={passos} icon="check" /> : null}
      {nCom ? <Tag label={String(nCom)} icon="chat" /> : null}
      {by ? <Txt w="semibold" size={13} color={C.ok}>por {by}</Txt> : null}
    </View>
  );
}

function TaskRow({ t, first }: { t: Task; first: boolean }) {
  const sheets = useSheets();
  const mover = useMoverTarefa();
  return (
    <Pressable onPress={() => sheets.open({ kind: 'task', task: t })}
      style={({ pressed }) => ({ flexDirection: 'row', gap: 12, padding: 12, paddingHorizontal: 14, alignItems: 'flex-start', backgroundColor: pressed ? C.pressed : C.surface, borderTopWidth: first ? 0 : 1, borderTopColor: C.line })}>
      <View style={{ paddingTop: 1 }}><CheckBox checked={t.done} onChange={v => mover(t, v ? 'feito' : 'fazer')} label={`Feito: ${t.title}`} /></View>
      <View style={{ flex: 1, gap: 5 }}>
        <Txt w="semibold" size={15.5} color={t.done ? C.muted : C.ink} style={t.done ? { textDecorationLine: 'line-through' } : undefined}>{t.title}</Txt>
        <Detalhes t={t} />
        {t.notes ? <Muted size={13.5}>{t.notes}</Muted> : null}
      </View>
    </Pressable>
  );
}

/* ---------- quadro (como o Trello) ---------- */

const MAX_FEITAS = 12;

function Quadro({ tasks }: { tasks: Task[] }) {
  const { width } = useWindowDimensions();
  const largo = width >= 760;
  const colunas = COLUNAS.map(([k, label]) => {
    let ts = tasks.filter(t => colunaDe(t) === k);
    ts = k === 'feito'
      ? ts.sort((a, b) => String(b.done_at ?? '').localeCompare(String(a.done_at ?? '')))
      : ts.sort((a, b) => (dueInfo(a.due)?.days ?? 9999) - (dueInfo(b.due)?.days ?? 9999) || String(a.created_at).localeCompare(String(b.created_at)));
    return { k, label, ts };
  });
  const corpo = colunas.map(c => (
    <View key={c.k} style={[{ gap: 8, padding: 10, borderRadius: R.card, backgroundColor: C.sunken }, largo ? { flex: 1 } : { width: Math.min(300, width * 0.8) }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <Txt w="semibold" size={14.5}>{c.label}</Txt>
        <Muted size={13}>{String(c.ts.length)}</Muted>
      </View>
      {c.ts.length ? (c.k === 'feito' ? c.ts.slice(0, MAX_FEITAS) : c.ts).map(t => <Cartao key={t.id} t={t} col={c.k} />) : (
        <Muted size={13} style={{ paddingHorizontal: 4, paddingVertical: 8 }}>{c.k === 'fazendo' ? 'Movam para cá o que já começaram.' : 'Nada aqui.'}</Muted>
      )}
      {c.k === 'feito' && c.ts.length > MAX_FEITAS ? <Muted size={12.5} style={{ paddingHorizontal: 4 }}>{`e mais ${c.ts.length - MAX_FEITAS} feitas`}</Muted> : null}
    </View>
  ));
  return largo ? <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>{corpo}</View> : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, alignItems: 'flex-start' }} style={{ marginHorizontal: -4 }}>
      {corpo}
    </ScrollView>
  );
}

function Cartao({ t, col }: { t: Task; col: Coluna }) {
  const sheets = useSheets();
  const mover = useMoverTarefa();
  const i = COLUNAS.findIndex(([k]) => k === col);
  const antes = i > 0 ? COLUNAS[i - 1] : null, depois = i < COLUNAS.length - 1 ? COLUNAS[i + 1] : null;
  return (
    <Pressable onPress={() => sheets.open({ kind: 'task', task: t })}
      style={({ pressed }) => ({ gap: 6, padding: 10, borderRadius: R.card, borderWidth: 1, borderColor: C.line, backgroundColor: pressed ? C.pressed : C.surface })}>
      <Txt w="semibold" size={14.5} color={t.done ? C.muted : C.ink}>{t.title}</Txt>
      <Detalhes t={t} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
        {antes ? <IconBtn icon="back" size={28} color={C.muted} label={`Mover para ${antes[1]}`} onPress={() => mover(t, antes[0])} /> : <View />}
        {depois ? (
          <View style={{ transform: [{ rotate: '180deg' }] }}>
            <IconBtn icon="back" size={28} color={C.muted} label={`Mover para ${depois[1]}`} onPress={() => mover(t, depois[0])} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
