import type { ReactNode } from 'react';
import { Linking, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { dueInfo, effective, hasPaid, optsOf, PARCELAS, PHASE, PRIO, qtyOf, spentOf, sub, thumbOf } from '@/lib/calc';
import { dateBR, dayLabel, hostOf, money, safeUrl } from '@/lib/format';
import { cabe, cabeTxt, cmInput, medidasTxt } from '@/lib/medidas';
import type { ItemOption } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { AccentCtx, Btn, LikeBtn, Muted, Pill, Serif, Tag, Txt, useAccent } from '@/ui/kit';
import { Photo } from '@/ui/Photo';
import { Sheet, Spacer } from '@/ui/Sheet';
import { ACCENT, C, R, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { Conversa } from '../conversa/Conversa';
import { useSheets } from '../sheetsCtx';
import { useShopOps } from './ops';
import { PrecoNaLoja } from './PrecoNaLoja';

export function ItemDetailSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const d = useData();
  const it = d.t.items.find(i => i.id === id);
  const list = it ? d.secById(it.section_id)?.list : undefined;
  return (
    <AccentCtx.Provider value={ACCENT[list || 'casa']}>
      <Inner id={id} onClose={onClose} visible={!!it} />
    </AccentCtx.Provider>
  );
}

function Inner({ id, onClose, visible }: { id: string; onClose: () => void; visible: boolean }) {
  const d = useData();
  const { update, me } = useActions();
  const sheets = useSheets();
  const toast = useToast();
  const accent = useAccent();
  const { setBought } = useShopOps();
  const it = d.t.items.find(i => i.id === id);
  if (!it) return <Sheet visible={false} onClose={onClose} />;

  const sec = d.secById(it.section_id), list = sec?.list;
  const q = qtyOf(it), url = safeUrl(it.link), opts = optsOf(it);
  const pr = PRIO[it.priority] ? it.priority : 'media';
  const cheapest = effective(opts, '');
  const eco = it.bought && !it.gift && hasPaid(it) ? sub(it) - Number(it.paid) : 0;
  const by = d.memberName(it.bought_by);
  const fit = cabe(it);
  const garantia = dueInfo(it.warranty_until);

  const likeOpt = async (o: ItemOption) => {
    const on = o.likes?.includes(me);
    const next = opts.map(x => (x.id !== o.id ? x : { ...x, likes: on ? (x.likes || []).filter(u => u !== me) : [...(x.likes || []), me] }));
    try { await update('items', it.id, { options: next }); } catch (e: any) { toast(e.message, 'x'); }
  };
  const chooseOpt = async (o: ItemOption) => {
    const chosen = it.chosen === o.id ? '' : o.id;
    const eff = effective(opts, chosen);
    const patch: any = { chosen };
    if (eff) Object.assign(patch, { price: Number(eff.price) || it.price, store: eff.store || '', link: eff.link || '', estimado: false });
    try {
      await update('items', it.id, patch);
      if (chosen) toast('Opção escolhida', 'heart');
    } catch (e: any) { toast(e.message, 'x'); }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      media={
        <View style={{ height: 230, backgroundColor: soft(accent) }}>
          {thumbOf(it) ? <Photo path={thumbOf(it)} fit="contain" style={{ width: '100%', height: '100%' }} /> : (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <Icon name={sec?.icon || 'image'} size={60} color={accent} />
              <Muted size={13}>Sem foto ainda. Toque em Editar para adicionar.</Muted>
            </View>
          )}
        </View>
      }
      footer={<>
        <Btn label="Editar" kind="ghost" icon="pencil" onPress={() => sheets.open({ kind: 'item', item: it })} />
        <Spacer />
        <Btn label={it.bought ? 'Desmarcar' : 'Marcar como comprado'} kind={it.bought ? 'ghost' : 'ok'} icon={it.bought ? 'undo' : 'check'} onPress={() => setBought(it, !it.bought)} />
      </>}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {sec ? <Tag label={sec.name} icon={sec.icon || 'box'} /> : null}
        <Pill label={`Prioridade ${PRIO[pr].label.toLowerCase()}`} kind={pr} />
        {list === 'casa' && PHASE[it.phase] ? <Tag label={PHASE[it.phase]} icon="flag" /> : null}
        {list === 'switch' && it.coop ? <Tag label="Dá para jogar a dois" icon="users" /> : null}
      </View>
      <Serif size={30}>{it.name}</Serif>
      <View style={{ gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <Txt w="medium" size={32} color={accent} style={{ letterSpacing: -0.6, lineHeight: 38 }}>
            {it.bought ? (it.gift ? 'Presente' : money(spentOf(it))) : `${it.estimado ? '≈ ' : ''}${money(sub(it))}`}
          </Txt>
          <Muted>{it.bought && !it.gift && hasPaid(it) ? `previsto ${money(sub(it))}` : q > 1 ? `${q} × ${money(it.price)}` : ''}</Muted>
        </View>
        {!it.bought && sub(it) > 0 ? <Muted>{`ou ${PARCELAS}× de ${money(sub(it) / PARCELAS)}${it.estimado ? ' · preço estimado' : ''}`}</Muted> : null}
      </View>
      {!it.bought && url ? <PrecoNaLoja itemId={it.id} anotado={Number(it.price) || 0} /> : null}
      {it.notes ? <View style={{ padding: 12, borderRadius: 10, backgroundColor: C.bg }}><Txt size={14.5}>{it.notes}</Txt></View> : null}

      {opts.length ? (
        <View style={{ gap: 8 }}>
          <Txt w="semibold" size={13} color={C.muted} upper track={1.2}>{opts.length === 1 ? 'Opção' : `Opções (${opts.length})`}</Txt>
          {opts.map(o => {
            const on = it.chosen === o.id, ourl = safeUrl(o.link);
            return (
              <View key={o.id} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: on ? C.ok : C.line, backgroundColor: on ? C.okSoft : 'transparent' }}>
                <Photo path={o.image} icon="image" iconSize={16} style={{ width: 48, height: 48, borderRadius: R.icon }} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Txt w="semibold">{o.name || o.store || 'Opção'}</Txt>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {o.store && o.name ? <Muted size={13}>{o.store}</Muted> : null}
                    {ourl ? <Txt w="semibold" size={13} color={accent}>{hostOf(ourl)}</Txt> : null}
                    {cheapest && cheapest.id === o.id && opts.length > 1 ? <Pill label="Mais barato" kind="ok" /> : null}
                  </View>
                  <Txt w="medium" size={15}>{Number(o.price) > 0 ? money(o.price) : 'sem preço'}</Txt>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                    <LikeBtn on={!!o.likes?.includes(me)} count={(o.likes || []).length} onPress={() => likeOpt(o)} />
                    <Btn label={on ? 'Escolhida' : 'Escolher'} kind={on ? 'ok' : 'ghost'} size="xs" icon={on ? 'check' : undefined} onPress={() => chooseOpt(o)} />
                    {ourl ? <Btn label="Abrir" kind="ghost" size="xs" icon="ext" onPress={() => Linking.openURL(ourl)} /> : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <View>
        <DetRow label="Situação">
          {it.bought ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Icon name={it.gift ? 'gift' : 'check'} size={16} color={C.ok} />
              <Txt w="semibold" color={C.ok}>{it.gift ? 'Ganharam de presente' : 'Comprado'}{by ? ` por ${by}` : ''}</Txt>
              {it.bought_at ? <Muted size={13}>em {dateBR(it.bought_at)}</Muted> : null}
            </View>
          ) : <Txt>Ainda não comprado</Txt>}
        </DetRow>
        {it.bought ? (
          <DetRow label="Pagamento">
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Txt style={{ textAlign: 'right' }}>
                {it.gift ? 'Presente' : hasPaid(it) ? money(it.paid) : 'valor não anotado'}
                {Math.abs(eco) > 0.5 ? <Txt color={eco > 0 ? C.ok : C.hi}>{` (${eco > 0 ? 'economia de' : 'acima em'} ${money(Math.abs(eco))})`}</Txt> : null}
                {d.whoLabel(it.payer) ? ` · ${d.whoLabel(it.payer)}` : ''}
              </Txt>
              <Btn label={hasPaid(it) || it.payer || it.gift ? 'Alterar' : 'Anotar'} kind="ghost" size="xs" onPress={() => sheets.open({ kind: 'buy', id: it.id })} />
            </View>
          </DetRow>
        ) : null}
        {it.store ? <DetRow label="Loja"><Txt>{it.store}</Txt></DetRow> : null}
        {url ? <DetRow label="Produto"><Btn label={`Abrir em ${hostOf(url) || 'site'}`} kind="ghost" size="sm" icon="ext" onPress={() => Linking.openURL(url)} /></DetRow> : null}
        {medidasTxt(it) ? (
          <DetRow label="Medidas">
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              <Txt>{medidasTxt(it)}</Txt>
              {fit ? <Txt w="semibold" size={13} color={fit.ok ? C.ok : C.hi}>{cabeTxt(fit)}{` (espaço de ${cmInput(it.space)} cm)`}</Txt> : null}
            </View>
          </DetRow>
        ) : null}
        {it.bought && (it.warranty_until || safeUrl(it.manual)) ? (
          <DetRow label="Garantia">
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              {it.warranty_until ? <Txt color={garantia && garantia.days < 0 ? C.muted : C.ink}>{garantia && garantia.days < 0 ? `venceu em ${dayLabel(it.warranty_until, true)}` : `até ${dayLabel(it.warranty_until, true)}`}</Txt> : null}
              {safeUrl(it.manual) ? <Btn label="Manual / nota" kind="ghost" size="xs" icon="ext" onPress={() => Linking.openURL(safeUrl(it.manual))} /> : null}
            </View>
          </DetRow>
        ) : null}
      </View>
      <Conversa target="items" id={it.id} />
    </Sheet>
  );
}

function DetRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.line }}>
      <Muted size={14.5}>{label}</Muted>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>{children}</View>
    </View>
  );
}
