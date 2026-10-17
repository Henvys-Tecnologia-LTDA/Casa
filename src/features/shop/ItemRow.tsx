import { Linking, Pressable, View } from 'react-native';

import { useData } from '@/data/DataProvider';
import { hasPaid, optsOf, PHASE, PRIO, qtyOf, spentOf, sub, thumbOf } from '@/lib/calc';
import { hostOf, money, safeUrl } from '@/lib/format';
import { cabe } from '@/lib/medidas';
import type { Item } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { CheckBox, Muted, Pill, Tag, Txt, useAccent } from '@/ui/kit';
import { Photo } from '@/ui/Photo';
import { Appear } from '@/ui/Screen';
import { C } from '@/ui/theme';

import { useComentarios } from '../conversa/Conversa';
import { useSheets } from '../sheetsCtx';
import { useShopOps } from './ops';

export function ItemRow({ item, showSection, first }: { item: Item; showSection?: boolean; first?: boolean }) {
  const d = useData();
  const sheets = useSheets();
  const { setBought } = useShopOps();
  const accent = useAccent();
  const sec = d.secById(item.section_id);
  const list = sec?.list;
  const pr = PRIO[item.priority] ? item.priority : 'media';
  const url = safeUrl(item.link);
  const q = qtyOf(item);
  const opts = optsOf(item);
  const n = Number(item.parcelas) || 1;
  const priceTxt = item.bought ? (item.gift ? 'Presente' : money(spentOf(item))) : `${item.estimado ? '≈ ' : ''}${money(sub(item))}`;
  const under = item.bought && !item.gift && hasPaid(item) && Math.abs(Number(item.paid) - sub(item)) > 0.5 ? `previsto ${money(sub(item))}`
    : q > 1 && !item.bought ? `${q} × ${money(item.price)}` : '';
  const by = item.bought ? d.memberName(item.bought_by) : '';
  const nCom = useComentarios(item.id);
  const fit = item.bought ? null : cabe(item);

  return (
    <Pressable
      onPress={() => sheets.open({ kind: 'detail', id: item.id })}
      style={({ pressed }) => ({
        flexDirection: 'row', gap: 12, padding: 12, alignItems: 'flex-start',
        backgroundColor: pressed ? C.pressed : C.surface, borderTopWidth: first ? 0 : 1, borderTopColor: C.line,
      })}>
      <View style={{ paddingTop: 14 }}>
        <CheckBox checked={item.bought} onChange={v => setBought(item, v)} label={`Comprado: ${item.name}`} />
      </View>
      <Photo path={thumbOf(item)} icon={sec?.icon || 'box'} style={{ width: 52, height: 52, borderRadius: 8, borderWidth: 1, borderColor: C.line, opacity: item.bought ? 0.55 : 1 }} />
      <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
        <Txt w="semibold" size={16} color={item.bought ? C.muted : C.ink} style={item.bought ? { textDecorationLine: 'line-through' } : undefined}>{item.name}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, columnGap: 10 }}>
          <Pill label={PRIO[pr].label} kind={pr} />
          {showSection && sec ? <Tag label={sec.name} /> : null}
          {list === 'casa' && PHASE[item.phase] ? <Tag label={PHASE[item.phase]} icon="flag" /> : null}
          {list === 'switch' && item.coop ? <Tag label="A dois" icon="users" /> : null}
          {opts.length > 1 && !item.chosen && !item.bought ? <Pill label={`${opts.length} opções`} kind="acc" /> : null}
          {item.gift && item.bought ? <Tag label="Presente" icon="gift" /> : null}
          {fit && !fit.ok ? <Pill label="Não cabe" kind="alta" icon="ruler" /> : null}
          {nCom ? <Tag label={String(nCom)} icon="chat" /> : null}
          {by ? <Txt w="semibold" size={13} color={C.ok}>por {by}</Txt> : null}
          {item.bought && d.whoLabel(item.payer) ? <Muted size={13}>pago: {d.whoLabel(item.payer)}</Muted> : null}
          {item.store && !item.bought ? <Muted size={13}>{item.store}</Muted> : null}
          {url ? (
            <Pressable onPress={() => Linking.openURL(url)} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Txt w="semibold" size={13} color={accent}>{hostOf(url) || 'Ver produto'}</Txt>
              <Icon name="ext" size={13} color={accent} />
            </Pressable>
          ) : null}
        </View>
        {item.notes ? <Muted size={13.5}>{item.notes}</Muted> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 8 }}>
          <Txt w="medium" size={16} color={item.bought ? C.ok : C.ink}>{priceTxt}</Txt>
          {under ? <Muted size={12}>{under}</Muted> : null}
          {item.bought && !item.gift && n > 1 ? <Muted size={12}>{`${n}× de ${money(spentOf(item) / n)}`}</Muted> : null}
        </View>
      </View>
    </Pressable>
  );
}

export function ItemList({ items, showSection }: { items: Item[]; showSection?: boolean }) {
  return (
    <View style={{ backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 3, overflow: 'hidden' }}>
      {items.map((i, k) => <Appear key={i.id} i={k}><ItemRow item={i} showSection={showSection} first={k === 0} /></Appear>)}
    </View>
  );
}
