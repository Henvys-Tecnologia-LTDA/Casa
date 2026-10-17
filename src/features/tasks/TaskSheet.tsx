import { useState } from 'react';
import { View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { dayToInput, inputToDay, uuid } from '@/lib/format';
import { REPEAT_L } from '@/lib/tarefas';
import type { Phase, Repeat, Task, TaskStep, Who } from '@/lib/types';
import { DayField } from '@/ui/fields';
import { AccentCtx, Btn, CheckBox, ErrText, Field, IconBtn, Seg, Toggle, Txt } from '@/ui/kit';
import { Sheet, Spacer, useConfirm } from '@/ui/Sheet';
import { ACCENT, C } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { useApagar } from '@/ui/useApagar';

import { Conversa } from '../conversa/Conversa';

const REPEAT_OPTS: [Repeat, string][] = [['', 'Não repete'], ...(Object.entries(REPEAT_L) as [Repeat, string][])];
const hojeISO = () => { const d = new Date(); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`; };

export function TaskSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const d = useData();
  const { insert, update, me } = useActions();
  const apagar = useApagar();
  const toast = useToast();
  const confirm = useConfirm();
  const [title, setTitle] = useState(task?.title || '');
  const [phase, setPhase] = useState<Phase>(task?.phase || 'antes');
  const [who, setWho] = useState<Who>(task?.who || '');
  const [due, setDue] = useState(dayToInput(task?.due));
  const [notes, setNotes] = useState(task?.notes || '');
  const [done, setDone] = useState(!!task?.done);
  const [steps, setSteps] = useState<TaskStep[]>(task?.steps || []);
  const [passo, setPasso] = useState('');
  const [repeat, setRepeat] = useState<Repeat>(task?.repeat || '');
  const [rotate, setRotate] = useState(!!task?.rotate);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  function addPasso() {
    const t = passo.trim();
    if (!t) return;
    setPasso('');
    setSteps(s => [...s, { id: uuid(), text: t, done: false }]);
  }
  // Repetir sem prazo começa hoje.
  function escolherRepeat(r: Repeat) {
    setRepeat(r);
    if (r && !due.trim()) setDue(hojeISO());
  }

  async function save() {
    const t = title.trim();
    if (!t) { setErr('Escreva o que precisa ser feito.'); return; }
    const dueV = due.trim() ? inputToDay(due) : '';
    if (due.trim() && !dueV) { setErr('Prazo inválido. Use DD/MM/AAAA.'); return; }
    const fim = repeat ? false : done;
    const changed = fim !== !!task?.done;
    const pend = passo.trim() ? [...steps, { id: uuid(), text: passo.trim(), done: false }] : steps;
    const data: Partial<Task> = {
      title: t, phase, who, due: dueV || null, notes: notes.trim(), done: fim, steps: pend,
      repeat, rotate: !!repeat && rotate && (who === 'a' || who === 'b'),
      doing: fim ? false : task?.doing ?? false,
      done_by: fim ? (changed ? me : task?.done_by ?? null) : null,
      done_at: fim ? (changed ? new Date().toISOString() : task?.done_at ?? null) : null,
    };
    setBusy(true);
    try {
      if (task) await update('tasks', task.id, data); else await insert('tasks', data);
      onClose();
      toast(task ? 'Tarefa salva' : 'Tarefa adicionada', task ? 'check' : 'plus');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  async function del() {
    if (!task) return;
    const ok = await confirm({ title: `Excluir “${task.title}”?`, text: 'A tarefa sai da lista de vocês dois.', yes: 'Excluir tarefa' });
    if (!ok) return;
    try { await apagar('tasks', task.id, 'Tarefa excluída'); onClose(); } catch (e: any) { setErr(e?.message || ''); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.mudanca}>
      <Sheet visible onClose={onClose} title={task ? 'Editar tarefa' : 'Nova tarefa'} footer={<>
        {task ? <Btn label="Excluir" kind="danger" icon="trash" onPress={del} /> : null}
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Field label="O que precisa fazer" value={title} onChangeText={setTitle} placeholder="Ex.: Contratar internet" autoFocus={!task} />
        {!repeat ? <Seg label="Etapa" value={phase} onChange={setPhase} options={[['antes', 'Antes da mudança'], ['mes1', 'Primeiro mês'], ['calma', 'Com calma']]} /> : null}
        <Seg label="Quem faz" value={who} onChange={setWho} options={[['a', d.nm('a')], ['b', d.nm('b')], ['ambos', 'Os dois']]} />
        <DayField label={repeat ? 'Próxima vez' : 'Prazo'} value={due} onChange={setDue} />
        <Seg label="Repetir" value={repeat} onChange={escolherRepeat} options={REPEAT_OPTS} />
        {repeat && (who === 'a' || who === 'b') ? (
          <Toggle label={`Revezar: na próxima vez é ${who === 'a' ? d.nm('b') : d.nm('a')}`} value={rotate} onChange={setRotate} />
        ) : null}

        <View style={{ gap: 8 }}>
          <Txt w="semibold" size={12.5} color={C.muted}>Passos</Txt>
          {steps.map((s, k) => (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <CheckBox checked={s.done} label={`Passo feito: ${s.text}`} onChange={v => setSteps(xs => xs.map((x, i) => (i === k ? { ...x, done: v } : x)))} />
              <Txt size={14.5} color={s.done ? C.muted : C.ink} style={[{ flex: 1 }, s.done ? { textDecorationLine: 'line-through' } : null]}>{s.text}</Txt>
              <IconBtn icon="x" size={28} color={C.muted} label={`Tirar o passo ${s.text}`} onPress={() => setSteps(xs => xs.filter((_, i) => i !== k))} />
            </View>
          ))}
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <Field value={passo} onChangeText={setPasso} placeholder={steps.length ? 'Mais um passo…' : 'Ex.: ligar para 3 empresas'} onSubmit={addPasso} style={{ flex: 1 }} />
            <IconBtn icon="plus" label="Adicionar passo" onPress={addPasso} />
          </View>
        </View>

        <Field label="Observações" value={notes} onChangeText={setNotes} placeholder="Telefone, protocolo, horário…" multiline />
        {!repeat ? <Toggle label="Feito" value={done} onChange={setDone} /> : null}
        <ErrText msg={err} />
        {task ? <Conversa target="tasks" id={task.id} /> : null}
      </Sheet>
    </AccentCtx.Provider>
  );
}
