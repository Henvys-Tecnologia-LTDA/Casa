import { useState } from 'react';
import { View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { hora, rotuloDia } from '@/lib/atividade';
import type { Comment } from '@/lib/types';
import { Btn, Field, IconBtn, Muted, Txt, useAccent } from '@/ui/kit';
import { C, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { useApagar } from '@/ui/useApagar';

// Conversa curta num item ou numa tarefa (como os comentários dos cartões do Trello): o outro recebe
// aviso e o comentário entra no "O que mudou". Sem nenhum comentário, aparece só o botão "Comentar".

export function Conversa({ target, id }: { target: Comment['target_table']; id: string }) {
  const d = useData();
  const { insert, me } = useActions();
  const apagar = useApagar();
  const toast = useToast();
  const accent = useAccent();
  const [aberta, setAberta] = useState(false);
  const [txt, setTxt] = useState('');
  const list = d.t.comments.filter(c => c.target_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at));

  async function enviar() {
    const body = txt.trim();
    if (!body) return;
    setTxt('');
    try {
      await insert('comments', { target_table: target, target_id: id, body, by_user: me });
    } catch (e: any) {
      setTxt(body);
      toast(e?.message || 'Não foi possível enviar.', 'x');
    }
  }

  if (!list.length && !aberta) {
    return (
      <View style={{ alignSelf: 'flex-start' }}>
        <Btn label="Comentar" kind="ghost" size="sm" icon="chat" onPress={() => setAberta(true)} />
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <Txt w="semibold" size={13} color={C.muted} upper track={1.2}>Conversa</Txt>
      {list.map(c => {
        const eu = c.by_user === me;
        const nome = eu ? 'Você' : d.memberName(c.by_user) || 'Alguém';
        return (
          <View key={c.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: eu ? C.sunken : soft(accent), alignItems: 'center', justifyContent: 'center' }}>
              <Txt w="semibold" size={12.5} color={eu ? C.muted : accent}>{nome.slice(0, 1).toUpperCase()}</Txt>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <Muted size={12}>{`${nome} · ${rotuloDia(c.created_at)} ${hora(c.created_at)}`}</Muted>
              <Txt size={14.5}>{c.body}</Txt>
            </View>
            {eu ? (
              <IconBtn icon="x" size={26} color={C.muted} label="Apagar comentário"
                onPress={() => { apagar('comments', c.id, 'Comentário apagado').catch(() => {}); }} />
            ) : null}
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <Field value={txt} onChangeText={setTxt} placeholder="Escreva um comentário…" onSubmit={enviar} style={{ flex: 1 }}
          autoFocus={!list.length} maxLength={1000} />
        <IconBtn icon="send" label="Enviar comentário" color={accent} onPress={enviar} />
      </View>
    </View>
  );
}

/** Quantos comentários tem um item ou tarefa (para o ícone discreto nas listas). */
export function useComentarios(id: string) {
  const d = useData();
  return d.t.comments.reduce((n, c) => (c.target_id === id ? n + 1 : n), 0);
}
