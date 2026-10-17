import { useState } from 'react';

import { useActions } from '@/data/DataProvider';
import type { Note, NoteKind } from '@/lib/types';
import { AccentCtx, Btn, ErrText, Field, Hint, Seg } from '@/ui/kit';
import { Sheet, Spacer, useConfirm } from '@/ui/Sheet';
import { ACCENT } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { useApagar } from '@/ui/useApagar';

// Uma anotação do Caderno da casa: wi-fi (rede e senha), contato (nome e telefone) ou texto livre.

const ROTULOS: Record<NoteKind, { title: string; ph: string; body: string; bodyPh: string }> = {
  wifi: { title: 'Nome da rede', ph: 'Ex.: CasaLuisCamila_5G', body: 'Senha', bodyPh: 'A senha do wi-fi' },
  contato: { title: 'Nome', ph: 'Ex.: Síndico, Frete, Eletricista', body: 'Observações', bodyPh: 'Horário, apartamento, quanto cobra…' },
  nota: { title: 'Título', ph: 'Ex.: Medidor de luz', body: 'Texto', bodyPh: 'O que precisam lembrar' },
};

export function NoteSheet({ note, tipo, title: title0, onClose }: { note: Note | null; tipo?: NoteKind; title?: string; onClose: () => void }) {
  const { insert, update } = useActions();
  const apagar = useApagar();
  const toast = useToast();
  const confirm = useConfirm();
  const [kind, setKind] = useState<NoteKind>(note?.kind || tipo || 'nota');
  const [title, setTitle] = useState(note?.title || title0 || '');
  const [body, setBody] = useState(note?.body || '');
  const [phone, setPhone] = useState(note?.phone || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const r = ROTULOS[kind];

  async function save() {
    const t = title.trim();
    if (!t) { setErr(`Preencha ${r.title.toLowerCase()}.`); return; }
    const data: Partial<Note> = { kind, title: t, body: body.trim(), phone: kind === 'contato' ? phone.trim() : '' };
    setBusy(true);
    try {
      if (note) await update('notes', note.id, data); else await insert('notes', data);
      onClose();
      toast(note ? 'Anotação salva' : 'Anotado no caderno', note ? 'check' : 'book');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  async function del() {
    if (!note) return;
    const ok = await confirm({ title: `Apagar “${note.title}”?`, text: 'Sai do caderno de vocês dois.', yes: 'Apagar' });
    if (!ok) return;
    try { await apagar('notes', note.id, 'Anotação apagada'); onClose(); } catch (e: any) { setErr(e?.message || ''); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.mudanca}>
      <Sheet visible onClose={onClose} title={note ? 'Editar anotação' : 'Nova anotação'} footer={<>
        {note ? <Btn label="Apagar" kind="danger" icon="trash" onPress={del} /> : null}
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Seg value={kind} onChange={setKind} options={[['nota', 'Anotação'], ['contato', 'Contato'], ['wifi', 'Wi-fi']]} />
        <Field label={r.title} value={title} onChangeText={setTitle} placeholder={r.ph} autoFocus={!note && !title0} maxLength={120} />
        {kind === 'contato' ? <Field label="Telefone" value={phone} onChangeText={setPhone} placeholder="(11) 99999-9999" keyboardType="phone-pad" maxLength={40} /> : null}
        <Field label={r.body} value={body} onChangeText={setBody} placeholder={r.bodyPh} multiline={kind !== 'wifi'} maxLength={2000} />
        {kind === 'wifi' ? <Hint>Só o wi-fi: não guardem aqui senhas de banco ou de cartão.</Hint> : null}
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
