import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { frase, hora, porDia, type Atividade } from '@/lib/atividade';
import { friendlyError, supabase } from '@/lib/supabase';
import type { Emoji } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { Btn, Empty, Label, Muted, Note, Txt } from '@/ui/kit';
import { BackBar, Screen } from '@/ui/Screen';
import { ACCENT, C, F, R, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// "O que mudou": linha do tempo do casal nos últimos 30 dias, como o histórico do Trello e do
// Google Docs. Tocar numa linha abre a tela daquilo; no que o outro fez, dá para reagir com um emoji.

const EMOJIS: Emoji[] = ['❤️', '😂', '😮', '👏', '🙏'];

export function ActivityScreen() {
  const d = useData();
  const { hid, me } = useActions();
  const [list, setList] = useState<Atividade[] | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('household_activity', { p_household: hid });
    if (error) { setErr(friendlyError(error)); return; }
    setErr('');
    setList((data ?? []) as Atividade[]);
  }, [hid]);

  // Recarrega sempre que a tela volta a aparecer.
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const grupos = list ? porDia(list) : [];
  const aba = (tab: Atividade['tab']) => (tab === 'mercado' ? { label: 'Mercado', icon: 'cart' } : { label: d.tabs[tab]?.label ?? '', icon: d.tabs[tab]?.icon ?? 'box' });
  return (
    <Screen tab="casa" inTabs={false} onRefresh={load}>
      <BackBar label="Voltar" />
      <View style={{ gap: 4 }}>
        <Txt w="medium" size={28} style={{ letterSpacing: -0.6 }}>O que mudou</Txt>
        <Muted>O que cada um de vocês adicionou, comprou e concluiu nos últimos 30 dias.</Muted>
      </View>
      {err ? (
        <View style={{ gap: 10 }}>
          <Note kind="warn" icon="alert">{err}</Note>
          <View style={{ alignSelf: 'flex-start' }}><Btn label="Tentar de novo" kind="ghost" size="sm" icon="refresh" onPress={load} /></View>
        </View>
      ) : !list ? (
        <Muted>Carregando…</Muted>
      ) : !list.length ? (
        <Empty icon="clock" title="Nada por aqui ainda" text="Quando um de vocês adicionar, comprar ou concluir alguma coisa, aparece aqui." />
      ) : (
        <View style={{ gap: 18 }}>
          {grupos.map(g => (
            <View key={g.dia} style={{ gap: 8 }}>
              <Label>{g.dia}</Label>
              <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' }}>
                {g.itens.map((e, i) => <Linha key={e.id} e={e} first={i === 0} eu={e.actor === me} {...aba(e.tab)} />)}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function Linha({ e, first, eu, label, icon }: { e: Atividade; first: boolean; eu: boolean; label: string; icon: string }) {
  const accent = e.tab === 'mercado' ? C.ok : ACCENT[e.tab] ?? C.coral;
  const quem = eu ? 'Você' : e.actor_name;
  // As reações ficam fora da linha clicável (um botão não pode ficar dentro de outro).
  return (
    <View style={{ borderTopWidth: first ? 0 : 1, borderTopColor: C.line, backgroundColor: C.surface }}>
      <Pressable
        onPress={e.link ? () => router.push(e.link as Href) : undefined}
        accessibilityRole={e.link ? 'button' : undefined}
        style={({ pressed }) => ({
          flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
          backgroundColor: pressed ? C.pressed : C.surface,
        })}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: eu ? C.sunken : soft(C.coral), alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontFamily: F.serif, fontSize: 17, color: eu ? C.muted : C.coral }}>{quem.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Txt size={14.5}>
            <Text style={{ fontFamily: F.semibold }}>{quem}</Text> {frase(e)}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name={icon} size={13} color={accent} />
            <Muted size={12.5}>{label} · {hora(e.created_at)}</Muted>
          </View>
        </View>
        {e.link ? <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="back" size={14} color={C.muted} /></View> : null}
      </Pressable>
      <Reacoes e={e} podeReagir={!eu} />
    </View>
  );
}

// Reações (como no WhatsApp e no Slack): uma por pessoa; tocar no mesmo emoji tira a reação.
function Reacoes({ e, podeReagir }: { e: Atividade; podeReagir: boolean }) {
  const d = useData();
  const { insert, update, remove, me } = useActions();
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const rs = d.t.reactions.filter(r => Number(r.event_id) === Number(e.id));
  const minha = rs.find(r => r.by_user === me);

  async function reagir(emoji: Emoji) {
    setAberto(false);
    try {
      if (minha && minha.emoji === emoji) await remove('reactions', minha.id);
      else if (minha) await update('reactions', minha.id, { emoji });
      else await insert('reactions', { event_id: e.id, emoji, by_user: me });
    } catch (err: any) { toast(err?.message || 'Não foi possível reagir.', 'x'); }
  }

  if (!rs.length && !podeReagir) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: -6, paddingLeft: 62, paddingRight: 14, paddingBottom: 10 }}>
      {rs.map(r => (
        <View key={r.id} accessibilityLabel={`${r.by_user === me ? 'Você' : d.memberName(r.by_user)} reagiu ${r.emoji}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2, paddingHorizontal: 8, borderRadius: R.pill, backgroundColor: C.sunken }}>
          <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
          <Muted size={11.5}>{r.by_user === me ? 'você' : d.memberName(r.by_user)}</Muted>
        </View>
      ))}
      {podeReagir && aberto ? EMOJIS.map(em => (
        <Pressable key={em} onPress={() => reagir(em)} accessibilityRole="button" accessibilityLabel={`Reagir ${em}`} hitSlop={4}
          style={({ pressed }) => ({ paddingVertical: 3, paddingHorizontal: 7, borderRadius: R.pill, borderWidth: 1, borderColor: minha?.emoji === em ? C.coral : C.line, backgroundColor: pressed ? C.pressed : C.surface })}>
          <Text style={{ fontSize: 16 }}>{em}</Text>
        </Pressable>
      )) : null}
      {podeReagir ? (
        <Pressable onPress={() => setAberto(v => !v)} accessibilityRole="button" accessibilityLabel={aberto ? 'Fechar reações' : 'Reagir'} hitSlop={6}
          style={({ pressed }) => ({ padding: 3, borderRadius: R.pill, opacity: pressed ? 0.6 : 1 })}>
          <Icon name={aberto ? 'x' : 'smile'} size={17} color={C.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
