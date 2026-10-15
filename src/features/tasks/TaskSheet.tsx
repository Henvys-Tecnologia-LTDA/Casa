import { useState } from 'react';

import { useActions, useData } from '@/data/DataProvider';
import { dayToInput, inputToDay } from '@/lib/format';
import type { Phase, Task, Who } from '@/lib/types';
import { DayField } from '@/ui/fields';
import { AccentCtx, Btn, ErrText, Field, Seg, Toggle } from '@/ui/kit';
import { Sheet, Spacer, useConfirm } from '@/ui/Sheet';
import { ACCENT } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

export function TaskSheet({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const d = useData();
  const { insert, update, remove, me } = useActions();
  const toast = useToast();
  const confirm = useConfirm();
  const [title, setTitle] = useState(task?.title || '');
  const [phase, setPhase] = useState<Phase>(task?.phase || 'antes');
  const [who, setWho] = useState<Who>(task?.who || '');
  const [due, setDue] = useState(dayToInput(task?.due));
  const [notes, setNotes] = useState(task?.notes || '');
  const [done, setDone] = useState(!!task?.done);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const t = title.trim();
    if (!t) { setErr('Escreva o que precisa ser feito.'); return; }
    const dueV = due.trim() ? inputToDay(due) : '';
    if (due.trim() && !dueV) { setErr('Prazo inválido. Use DD/MM/AAAA.'); return; }
    const changed = done !== !!task?.done;
    const data: Partial<Task> = {
      title: t, phase, who, due: dueV || null, notes: notes.trim(), done,
      done_by: done ? (changed ? me : task?.done_by ?? null) : null,
      done_at: done ? (changed ? new Date().toISOString() : task?.done_at ?? null) : null,
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
    try { await remove('tasks', task.id); onClose(); toast('Tarefa excluída', 'trash'); } catch (e: any) { setErr(e?.message || ''); }
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
        <Seg label="Etapa" value={phase} onChange={setPhase} options={[['antes', 'Antes da mudança'], ['mes1', 'Primeiro mês'], ['calma', 'Com calma']]} />
        <Seg label="Quem faz" value={who} onChange={setWho} options={[['a', d.nm('a')], ['b', d.nm('b')], ['ambos', 'Os dois']]} />
        <DayField label="Prazo" value={due} onChange={setDue} />
        <Field label="Observações" value={notes} onChangeText={setNotes} placeholder="Telefone, protocolo, horário…" multiline />
        <Toggle label="Feito" value={done} onChange={setDone} />
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
