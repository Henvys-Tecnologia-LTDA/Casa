import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { frase, hora, porDia, type Atividade } from '@/lib/atividade';
import { friendlyError, supabase } from '@/lib/supabase';
import { Icon } from '@/ui/Icon';
import { Btn, Empty, Label, Muted, Note, Txt } from '@/ui/kit';
import { BackBar, Screen } from '@/ui/Screen';
import { ACCENT, C, F, R, soft } from '@/ui/theme';

// "O que mudou": linha do tempo do casal nos últimos 30 dias, como o histórico do Trello e do
// Google Docs. Tocar numa linha abre a tela daquilo.

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
                {g.itens.map((e, i) => <Linha key={e.id} e={e} first={i === 0} eu={e.actor === me} tabLabel={d.tabs[e.tab]?.label ?? ''} tabIcon={d.tabs[e.tab]?.icon ?? 'box'} />)}
              </View>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

function Linha({ e, first, eu, tabLabel, tabIcon }: { e: Atividade; first: boolean; eu: boolean; tabLabel: string; tabIcon: string }) {
  const accent = ACCENT[e.tab] ?? C.coral;
  const quem = eu ? 'Você' : e.actor_name;
  return (
    <Pressable
      onPress={e.link ? () => router.push(e.link as Href) : undefined}
      accessibilityRole={e.link ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14,
        borderTopWidth: first ? 0 : 1, borderTopColor: C.line, backgroundColor: pressed ? C.pressed : C.surface,
      })}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: eu ? C.sunken : soft(C.coral), alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: F.serif, fontSize: 17, color: eu ? C.muted : C.coral }}>{quem.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt size={14.5}>
          <Text style={{ fontFamily: F.semibold }}>{quem}</Text> {frase(e)}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name={tabIcon} size={13} color={accent} />
          <Muted size={12.5}>{tabLabel} · {hora(e.created_at)}</Muted>
        </View>
      </View>
      {e.link ? <View style={{ transform: [{ rotate: '180deg' }] }}><Icon name="back" size={14} color={C.muted} /></View> : null}
    </Pressable>
  );
}
