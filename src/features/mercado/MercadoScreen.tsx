import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { lerItem, porSecao, secaoDe, textoMercado } from '@/lib/mercado';
import { MERCADO_BASICO } from '@/lib/modelos';
import type { Grocery } from '@/lib/types';
import { Atalho } from '@/ui/Atalho';
import { Btn, CheckBox, Empty, Field, Label, Muted, Txt } from '@/ui/kit';
import { BackBar, Loading, Screen } from '@/ui/Screen';
import { compartilhar } from '@/ui/share';
import { C, R } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { useSheets } from '../sheetsCtx';

// Lista do mercado do dia a dia (como o Bring!): o que um põe, o outro vê na hora e recebe aviso.
// Os itens vão sozinhos para a seção do mercado; marcados vão para "No carrinho" até limparem.

/** A linha que leva ao mercado, na aba Casa. */
export function AtalhoMercado() {
  const d = useData();
  const n = d.t.groceries.filter(g => !g.done).length;
  return <Atalho icon="cart" title="Mercado" sub={n ? `${n === 1 ? '1 item' : `${n} itens`} na lista` : 'A lista do dia a dia dos dois'} color={C.ok} onPress={() => router.push('/mercado')} />;
}

export function MercadoScreen() {
  const d = useData();
  const { insert, remove } = useActions();
  const toast = useToast();
  const [txt, setTxt] = useState('');
  const secs = porSecao(d.t.groceries);
  const carrinho = d.t.groceries.filter(g => g.done).sort((a, b) => String(b.done_at ?? '').localeCompare(String(a.done_at ?? '')));
  const faltam = secs.reduce((s, x) => s + x.itens.length, 0);

  async function add() {
    const raw = txt.trim();
    if (!raw) return;
    setTxt('');
    // Vários de uma vez, separados por vírgula ("leite, pão, 2 kg arroz").
    const partes = raw.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    try {
      for (const p of partes) {
        const { text, qty } = lerItem(p);
        const ja = d.t.groceries.find(g => !g.done && g.text.toLowerCase() === text.toLowerCase());
        if (ja) continue;
        await insert('groceries', { text, qty, cat: secaoDe(text) });
      }
    } catch (e: any) {
      setTxt(raw);
      toast(e?.message || 'Não foi possível salvar.', 'x');
    }
  }

  async function basico() {
    try { for (const [text, cat] of MERCADO_BASICO) await insert('groceries', { text, cat }); } catch (e: any) { toast(e?.message || 'Não foi possível salvar.', 'x'); }
  }

  // Limpa o carrinho de uma vez, com "Desfazer" que recoloca tudo.
  async function limpar() {
    const tirados = [...carrinho];
    try {
      for (const g of tirados) await remove('groceries', g.id);
      toast(`${tirados.length === 1 ? '1 item saiu' : `${tirados.length} itens saíram`} do carrinho`, 'trash', {
        label: 'Desfazer',
        fn: () => { (async () => { for (const g of tirados) await insert('groceries', g).catch(() => {}); })(); },
      });
    } catch (e: any) { toast(e?.message || 'Não foi possível limpar.', 'x'); }
  }

  return (
    <Screen tab="casa" inTabs={false}>
      <BackBar label="Voltar" />
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <View style={{ gap: 4, flexShrink: 1 }}>
          <Txt w="medium" size={28} style={{ letterSpacing: -0.6 }}>Mercado</Txt>
          <Muted>A lista do dia a dia dos dois. O que um põe, o outro vê na hora.</Muted>
        </View>
        {faltam ? <Btn label="Mandar" kind="ghost" size="sm" icon="share" onPress={() => compartilhar(textoMercado(d.t.groceries))} /> : null}
      </View>
      {!d.ready ? <Loading /> : (
        <>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <Field value={txt} onChangeText={setTxt} placeholder="O que falta? Ex.: leite, pão, 2 kg arroz" onSubmit={add} style={{ flex: 1 }} />
            <Btn label="Pôr" icon="plus" onPress={add} />
          </View>
          {!faltam && !carrinho.length ? (
            <Empty icon="cart" title="A lista está vazia" text="Escrevam acima o que falta. Dá para pôr vários de uma vez, separados por vírgula."
              action={<Btn label="Começar com a lista básica" kind="ghost" icon="cart" onPress={basico} />} />
          ) : null}
          {secs.map(s => (
            <View key={s.cat} style={{ gap: 6 }}>
              <Label>{s.label}</Label>
              <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' }}>
                {s.itens.map((g, i) => <Linha key={g.id} g={g} first={i === 0} />)}
              </View>
            </View>
          ))}
          {carrinho.length ? (
            <View style={{ gap: 6, marginTop: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Label>{`No carrinho (${carrinho.length})`}</Label>
                <Btn label="Limpar" kind="ghost" size="xs" icon="trash" onPress={limpar} />
              </View>
              <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden', opacity: 0.75 }}>
                {carrinho.map((g, i) => <Linha key={g.id} g={g} first={i === 0} />)}
              </View>
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function Linha({ g, first }: { g: Grocery; first: boolean }) {
  const d = useData();
  const { update, me } = useActions();
  const sheets = useSheets();
  const toast = useToast();
  const quem = g.by_user && g.by_user !== me ? d.memberName(g.by_user) : '';
  async function marcar(v: boolean) {
    try { await update('groceries', g.id, { done: v, done_at: v ? new Date().toISOString() : null }); } catch (e: any) { toast(e?.message || 'Não foi possível salvar.', 'x'); }
  }
  return (
    <Pressable onPress={() => sheets.open({ kind: 'grocery', g })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: first ? 0 : 1, borderTopColor: C.line, backgroundColor: pressed ? C.pressed : C.surface })}>
      <CheckBox checked={g.done} onChange={marcar} label={`No carrinho: ${g.text}`} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt size={15.5} color={g.done ? C.muted : C.ink} style={g.done ? { textDecorationLine: 'line-through' } : undefined}>
          {g.text}{g.qty ? <Txt size={14} color={C.muted}>{`  ${g.qty}`}</Txt> : null}
        </Txt>
      </View>
      {quem && !g.done ? <Muted size={12}>{quem}</Muted> : null}
    </Pressable>
  );
}
