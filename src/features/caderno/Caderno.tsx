import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { Linking, Pressable, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { dueInfo } from '@/lib/calc';
import { dayLabel, safeUrl } from '@/lib/format';
import type { Item, Note, NoteKind } from '@/lib/types';
import { Atalho } from '@/ui/Atalho';
import { Icon } from '@/ui/Icon';
import { Btn, Chip, Empty, IconBtn, Muted, Panel, Txt } from '@/ui/kit';
import { BackBar, Loading, Screen } from '@/ui/Screen';
import { ACCENT, C, R } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { useSheets } from '../sheetsCtx';

// Caderno da casa (como uma página do Notion): wi-fi, contatos (síndico, frete, eletricista),
// anotações e as garantias e manuais do que vocês compraram.

const SECOES: [NoteKind, string, string][] = [['wifi', 'Wi-fi', 'wifi'], ['contato', 'Contatos', 'phone'], ['nota', 'Anotações', 'book']];
const SUGESTOES: [NoteKind, string][] = [['wifi', 'Wi-fi de casa'], ['contato', 'Síndico'], ['contato', 'Portaria'], ['contato', 'Eletricista'], ['nota', 'Medidor de luz']];

const garantias = (items: Item[]) => items
  .filter(i => i.bought && (i.warranty_until || safeUrl(i.manual)))
  .sort((a, b) => String(a.warranty_until ?? '9999').localeCompare(String(b.warranty_until ?? '9999')));

/** A linha que leva ao caderno, na aba da Mudança. */
export function AtalhoCaderno() {
  const d = useData();
  const n = d.t.notes.length, g = garantias(d.t.items).length;
  const sub = n || g
    ? [n ? `${n} ${n === 1 ? 'anotação' : 'anotações'}` : '', g ? `${g} ${g === 1 ? 'garantia' : 'garantias'}` : ''].filter(Boolean).join(' · ')
    : 'Wi-fi, contatos e garantias à mão';
  return <Atalho icon="book" title="Caderno da casa" sub={sub} color={ACCENT.mudanca} onPress={() => router.push('/caderno')} />;
}

export function CadernoScreen() {
  const d = useData();
  const sheets = useSheets();
  const gs = garantias(d.t.items);
  const nova = (tipo: NoteKind = 'nota', title?: string) => sheets.open({ kind: 'note', note: null, tipo, title });

  return (
    <Screen tab="mudanca" inTabs={false} onFab={d.ready ? () => nova() : undefined} fabLabel="Nova anotação">
      <BackBar label="Voltar" />
      <View style={{ gap: 4 }}>
        <Txt w="medium" size={28} style={{ letterSpacing: -0.6 }}>Caderno da casa</Txt>
        <Muted>O que vocês dois precisam ter à mão: wi-fi, contatos, anotações e garantias.</Muted>
      </View>
      {!d.ready ? <Loading /> : (
        <>
          {!d.t.notes.length ? (
            <Empty icon="book" title="Nada anotado ainda" text="Comecem pelo wi-fi e pelos contatos do prédio. Os dois veem e editam."
              action={
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
                  {SUGESTOES.map(([k, t]) => <Chip key={t} label={t} icon="plus" onPress={() => nova(k, t)} />)}
                </View>
              } />
          ) : SECOES.map(([k, titulo, icon]) => {
            const ns = d.t.notes.filter(n => n.kind === k).sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
            if (!ns.length) return null;
            return (
              <Panel key={k} title={titulo} icon={icon} right={<IconBtn icon="plus" size={30} label={`Adicionar em ${titulo}`} onPress={() => nova(k)} />}>
                <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' }}>
                  {ns.map((n, i) => <Linha key={n.id} n={n} first={i === 0} />)}
                </View>
              </Panel>
            );
          })}
          {d.t.notes.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {SECOES.filter(([k]) => !d.t.notes.some(n => n.kind === k)).map(([k, t]) => <Chip key={k} label={t} icon="plus" onPress={() => nova(k)} />)}
            </View>
          ) : null}

          <Panel title="Garantias e manuais" icon="shield">
            {gs.length ? (
              <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: R.card, overflow: 'hidden' }}>
                {gs.map((it, i) => {
                  const g = dueInfo(it.warranty_until), url = safeUrl(it.manual);
                  return (
                    <Pressable key={it.id} onPress={() => sheets.open({ kind: 'detail', id: it.id })}
                      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, backgroundColor: pressed ? C.pressed : C.surface })}>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt w="semibold">{it.name}</Txt>
                        <Muted size={12.5} style={g && g.days < 0 ? undefined : g && g.days <= 60 ? { color: C.mid } : undefined}>
                          {it.warranty_until ? (g && g.days < 0 ? `garantia venceu em ${dayLabel(it.warranty_until, true)}` : `garantia até ${dayLabel(it.warranty_until, true)}`) : 'sem data de garantia'}
                        </Muted>
                      </View>
                      {url ? <Btn label="Manual" kind="ghost" size="xs" icon="ext" onPress={() => Linking.openURL(url)} /> : null}
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Muted size={13}>Quando marcarem um item como comprado, anotem até quando vai a garantia e o link do manual ou da nota.</Muted>
            )}
          </Panel>
        </>
      )}
    </Screen>
  );
}

function Linha({ n, first }: { n: Note; first: boolean }) {
  const sheets = useSheets();
  const toast = useToast();
  const tel = n.phone.replace(/\D/g, '');
  const zap = tel.length >= 10 && tel.length <= 11 ? `55${tel}` : tel;
  async function copiar(txt: string, o: string) {
    try { await Clipboard.setStringAsync(txt); toast(`${o} copiada`, 'copy'); } catch { toast('Não deu para copiar.', 'x'); }
  }
  return (
    <Pressable onPress={() => sheets.open({ kind: 'note', note: n })}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderTopWidth: first ? 0 : 1, borderTopColor: C.line, backgroundColor: pressed ? C.pressed : C.surface })}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt w="semibold">{n.title}</Txt>
        {n.kind === 'wifi' ? <Muted size={13.5}>{n.body ? `Senha: ${n.body}` : 'sem senha'}</Muted> : null}
        {n.kind === 'contato' && n.phone ? <Muted size={13.5}>{n.phone}</Muted> : null}
        {n.kind !== 'wifi' && n.body ? <Muted size={13.5} lines={n.kind === 'nota' ? 4 : 2}>{n.body}</Muted> : null}
      </View>
      {n.kind === 'wifi' && n.body ? <IconBtn icon="copy" size={32} label="Copiar a senha" onPress={() => copiar(n.body, 'Senha')} /> : null}
      {n.kind === 'contato' && tel ? (
        <View style={{ flexDirection: 'row', gap: 4 }}>
          <IconBtn icon="phone" size={32} label={`Ligar para ${n.title}`} onPress={() => Linking.openURL(`tel:${tel}`)} />
          <IconBtn icon="chat" size={32} label={`WhatsApp de ${n.title}`} onPress={() => Linking.openURL(`https://wa.me/${zap}`)} />
        </View>
      ) : null}
      {n.kind === 'nota' ? <Icon name="pencil" size={15} color={C.muted} /> : null}
    </Pressable>
  );
}
