import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { effective, hasPaid, optsOf, PARCELAS, qtyOf, SHOP } from '@/lib/calc';
import { fmtInput, inputToYm, money, nextYm, normLink, parsePrice, rid, ymToInput } from '@/lib/format';
import type { Item, ItemOption, Phase, Priority, ShopList, Who } from '@/lib/types';
import { MoneyField, MonthField, IntField } from '@/ui/fields';
import { Icon } from '@/ui/Icon';
import { AccentCtx, Btn, Chip, ErrText, Field, Grid2, Hint, IconBtn, Muted, SecTitle, Seg, Toggle, Txt } from '@/ui/kit';
import { deletePhotos, Photo, pickImage, uploadPhoto, type Picked } from '@/ui/Photo';
import { PhotoZone, usePhotoDraft } from '@/ui/PhotoZone';
import { Sheet, Spacer, useConfirm } from '@/ui/Sheet';
import { ACCENT, C, R } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

interface OptDraft { id: string; name: string; store: string; priceStr: string; link: string; image: string; likes: string[]; picked: Picked | null }

export function ItemEditorSheet({ item, secId, list, onClose }: { item: Item | null; secId?: string; list?: ShopList; onClose: () => void }) {
  const d = useData();
  const { insert, update, remove, hid, me } = useActions();
  const toast = useToast();
  const confirm = useConfirm();

  const firstSec = item?.section_id || secId || d.secs(list || 'casa')[0]?.id || d.secs('casa')[0]?.id || d.secs('switch')[0]?.id || '';
  const [name, setName] = useState(item?.name || '');
  const [sec, setSec] = useState(firstSec);
  const [price, setPrice] = useState(item ? fmtInput(item.price) : '');
  const [qty, setQty] = useState(String(item ? qtyOf(item) : 1));
  const [prio, setPrio] = useState<Priority>(item?.priority || 'media');
  const [phase, setPhase] = useState<Phase>(item?.phase || '');
  const [coop, setCoop] = useState(!!item?.coop);
  const [opts, setOpts] = useState<OptDraft[]>(() => (item ? optsOf(item) : []).map(o => ({
    id: o.id, name: o.name || '', store: o.store || '', priceStr: Number(o.price) > 0 ? fmtInput(o.price) : '', link: o.link || '',
    image: o.image || '', likes: o.likes || [], picked: null,
  })));
  const [chosen, setChosen] = useState(item?.chosen || '');
  const [store, setStore] = useState(item?.store || '');
  const [link, setLink] = useState(item?.link || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [bought, setBought] = useState(!!item?.bought);
  const [gift, setGift] = useState(!!item?.gift);
  const [paid, setPaid] = useState(item && hasPaid(item) ? fmtInput(item.paid) : '');
  const [payer, setPayer] = useState<Who>(item?.payer || '');
  const [parc, setParc] = useState(String(Number(item?.parcelas) || 1));
  const [parcStart, setParcStart] = useState(ymToInput(item?.parc_start || nextYm(item?.bought_at)));
  const photo = usePhotoDraft(item?.image || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const secList = d.secById(sec)?.list || list || 'casa';
  const priced = opts.map(o => ({ id: o.id, p: parsePrice(o.priceStr) || 0 })).filter(o => o.p > 0);
  const lockedPrice = priced.length ? (priced.find(o => o.id === chosen)?.p ?? Math.min(...priced.map(o => o.p))) : null;
  const priceShown = lockedPrice != null ? fmtInput(lockedPrice) : price;
  const p = parsePrice(priceShown), q = Math.max(1, parseInt(qty, 10) || 1), total = (p || 0) * q;
  const nParc = Math.max(1, parseInt(parc, 10) || 1);

  const setOpt = (k: number, patch: Partial<OptDraft>) => setOpts(os => os.map((o, i) => (i === k ? { ...o, ...patch } : o)));

  async function save() {
    if (busy) return;
    const nm = name.trim();
    if (!nm) { setErr('Dê um nome ao item.'); return; }
    let priceN = parsePrice(priceShown);
    if (priceN == null) { setErr('Preço inválido. Escreva algo como 199,90.'); return; }
    if (!sec) { setErr('Escolha um cômodo ou seção.'); return; }
    const link0 = normLink(link);
    if (link.trim() && !link0 && !opts.length) { setErr('O link não parece um endereço de site. Cole o endereço completo da loja.'); return; }
    for (const o of opts) if (o.priceStr.trim() && parsePrice(o.priceStr) == null) { setErr(`Preço inválido na opção “${o.name || o.store || 'sem nome'}”.`); return; }
    const paidN = paid.trim() ? parsePrice(paid) : null;
    if (bought && !gift && paid.trim() && paidN == null) { setErr('Valor pago inválido. Escreva algo como 199,90.'); return; }
    setBusy(true); setErr('');
    try {
      const image = await photo.result(hid);
      const options: ItemOption[] = [];
      for (const o of opts) {
        const op = parsePrice(o.priceStr) || 0;
        if (!o.name.trim() && !o.store.trim() && !o.link.trim() && !op && !o.picked && !o.image) continue;
        const img = o.picked ? await uploadPhoto(hid, o.picked) : o.image;
        options.push({ id: o.id, name: o.name.trim(), store: o.store.trim(), price: op, link: normLink(o.link), image: img, likes: o.likes });
      }
      const ch = options.some(o => o.id === chosen) ? chosen : '';
      const eff = effective(options, ch);
      if (eff) priceN = Number(eff.price) || priceN;
      const old = item;
      const changed = bought !== !!old?.bought;
      const data: Partial<Item> = {
        name: nm, price: priceN, qty: q, priority: prio,
        phase: secList === 'casa' ? phase : (old?.phase || ''),
        coop: secList === 'switch' ? coop : !!old?.coop,
        section_id: sec, notes: notes.trim(), image,
        store: eff ? eff.store || '' : store.trim(), link: eff ? eff.link || '' : link0,
        options, chosen: ch,
        bought, gift: bought && gift, paid: bought && !gift ? paidN : null,
        payer: bought ? payer : '',
        parcelas: bought && !gift ? Math.min(48, nParc) : 1,
        parc_start: bought && !gift && nParc > 1 ? (inputToYm(parcStart) || nextYm(old?.bought_at)) : '',
        bought_by: bought ? (changed ? me : old?.bought_by ?? null) : null,
        bought_at: bought ? (changed ? new Date().toISOString() : old?.bought_at ?? null) : null,
        estimado: !!(old?.estimado && priceN === Number(old.price)),
      };
      if (old) await update('items', old.id, data);
      else await insert('items', data);
      const keep = new Set([image, ...options.map(o => o.image)]);
      if (old) deletePhotos([old.image, ...optsOf(old).map(o => o.image)].filter(x => x && !keep.has(x)));
      onClose();
      const moved = old && old.section_id !== sec;
      toast(moved ? `Item movido para ${d.secById(sec)?.name || 'outro cômodo'}` : old ? 'Alterações salvas' : 'Item adicionado', moved ? 'back' : old ? 'check' : 'plus');
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!item) return;
    const ok = await confirm({ title: `Excluir “${item.name}”?`, text: 'O item e as fotos saem da lista de vocês dois. Isso não pode ser desfeito.', yes: 'Excluir item' });
    if (!ok) return;
    try {
      await remove('items', item.id);
      deletePhotos([item.image, ...optsOf(item).map(o => o.image)]);
      onClose();
      toast('Item excluído', 'trash');
    } catch (e: any) { setErr(e?.message || 'Não foi possível excluir.'); }
  }

  return (
    <AccentCtx.Provider value={ACCENT[secList]}>
      <Sheet
        visible
        onClose={onClose}
        title={item ? 'Editar item' : 'Novo item'}
        footer={<>
          {item ? <Btn label="Excluir" kind="danger" icon="trash" onPress={del} /> : null}
          <Spacer />
          <Btn label="Cancelar" kind="ghost" onPress={onClose} />
          <Btn label={busy ? 'Salvando…' : 'Salvar'} onPress={save} busy={busy} />
        </>}>
        <PhotoZone draft={photo} icon={d.secById(sec)?.icon || 'image'} hint="Foto do item: escolha da galeria ou tire com a câmera." />
        <Field label="Nome do item" value={name} onChangeText={setName} placeholder="Ex.: Jogo de panelas" autoFocus={!item} />

        <View style={{ gap: 6 }}>
          <Txt w="semibold" size={12.5} color={C.muted}>Cômodo ou seção</Txt>
          {SHOP.map(l => {
            const ss = d.secs(l);
            if (!ss.length) return null;
            return (
              <View key={l} style={{ gap: 6 }}>
                <Muted size={12}>{d.tabLabel(l)}</Muted>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {ss.map(s => <Chip key={s.id} label={s.name} icon={s.icon} on={sec === s.id} onPress={() => setSec(s.id)} />)}
                </View>
              </View>
            );
          })}
        </View>

        <Grid2>
          <MoneyField label="Preço unitário (R$)" value={priceShown} onChange={setPrice} editable={lockedPrice == null} />
          <IntField label="Quantidade" value={qty} onChange={setQty} />
        </Grid2>
        {p == null ? <Hint>Use um valor como 199,90</Hint> : total > 0 ? <Hint>{`Subtotal ${money(total)} · ou ${PARCELAS}× de ${money(total / PARCELAS)}`}</Hint> : null}
        {lockedPrice != null ? <Hint>{priced.some(o => o.id === chosen) ? 'O preço vem da opção escolhida.' : 'O preço vem da opção mais barata.'}</Hint> : null}
        {item?.estimado && p === Number(item.price) ? <Hint>Este preço é uma estimativa. Ao trocar pelo valor da loja, o “≈” some.</Hint> : null}

        <Seg label="Prioridade" value={prio} onChange={setPrio} options={[['alta', 'Alta'], ['media', 'Média'], ['baixa', 'Baixa']]} />
        {secList === 'casa' ? <Seg label="Etapa" value={phase} onChange={setPhase} options={[['antes', 'Antes'], ['mes1', '1º mês'], ['calma', 'Com calma']]} /> : null}
        {secList === 'switch' ? <Toggle label="Dá para jogar a dois" value={coop} onChange={setCoop} /> : null}

        <SecTitle>Opções e lojas</SecTitle>
        <Hint>Compare o mesmo produto em lojas diferentes ou dois modelos que vocês estão em dúvida. O preço do item passa a ser o da opção escolhida ou o mais barato.</Hint>
        {opts.map((o, k) => (
          <View key={o.id} style={{ gap: 8, padding: 10, borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.bg }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Pressable
                onPress={async () => { try { const pk = await pickImage(); if (pk) setOpt(k, { picked: pk }); } catch (e: any) { setErr(e?.message || ''); } }}
                accessibilityLabel="Foto desta opção">
                <Photo path={o.picked?.uri || o.image} icon="image" iconSize={16} style={{ width: 44, height: 44, borderRadius: R.icon }} />
              </Pressable>
              <Field value={o.name} onChangeText={v => setOpt(k, { name: v })} placeholder="Modelo ou descrição" style={{ flex: 1 }} />
              <IconBtn icon="x" label="Remover opção" size={30} onPress={() => {
                setOpts(os => os.filter((_, i) => i !== k));
                if (o.id === chosen) setChosen('');
              }} />
            </View>
            <Grid2>
              <Field value={o.store} onChangeText={v => setOpt(k, { store: v })} placeholder="Loja" />
              <Field value={o.priceStr} onChangeText={v => setOpt(k, { priceStr: v })} placeholder="Preço" keyboardType="decimal-pad" />
            </Grid2>
            <Field value={o.link} onChangeText={v => setOpt(k, { link: v })} placeholder="Link" autoCapitalize="none" keyboardType="url" />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Btn label={chosen === o.id ? 'Escolhida' : 'Escolher esta'} kind={chosen === o.id ? 'ok' : 'ghost'} size="xs" icon={chosen === o.id ? 'check' : undefined}
                onPress={() => setChosen(chosen === o.id ? '' : o.id)} />
            </View>
          </View>
        ))}
        <View style={{ alignSelf: 'flex-start' }}>
          <Btn label="Adicionar opção" kind="ghost" size="sm" icon="plus" onPress={() => setOpts(os => [...os, { id: rid(), name: '', store: '', priceStr: '', link: '', image: '', likes: [], picked: null }])} />
        </View>
        {!opts.length ? (
          <Grid2>
            <Field label="Loja" value={store} onChangeText={setStore} placeholder="Ex.: Magalu, Amazon, KaBuM" />
            <Field label="Link do produto" value={link} onChangeText={setLink} placeholder="https://" autoCapitalize="none" keyboardType="url" />
          </Grid2>
        ) : null}
        <Field label="Observações" value={notes} onChangeText={setNotes} placeholder="Medidas, cor, modelo, voltagem…" multiline />

        <Toggle label="Já compramos" value={bought} onChange={setBought} />
        {bought ? (
          <View style={{ gap: 12, padding: 14, borderRadius: 14, backgroundColor: C.okSoft }}>
            <Toggle label="Ganhamos de presente" value={gift} onChange={setGift} />
            {!gift ? <MoneyField label="Quanto pagaram no total (R$)" value={paid} onChange={setPaid} placeholder={total > 0 ? fmtInput(total) : '0,00'} /> : null}
            <Seg label="Quem pagou" value={payer} onChange={setPayer} options={[['a', d.nm('a')], ['b', d.nm('b')], ['ambos', 'Os dois']]} />
            {!gift ? (
              <Grid2>
                <IntField label="Parcelado em quantas vezes" value={parc} onChange={setParc} />
                {nParc > 1 ? <MonthField label="1ª parcela em" value={parcStart} onChange={setParcStart} /> : null}
              </Grid2>
            ) : null}
          </View>
        ) : null}
        <ErrText msg={err || photo.err} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="info" size={14} color={C.muted} />
          <Muted size={12}>As alterações aparecem na hora no celular do outro.</Muted>
        </View>
      </Sheet>
    </AccentCtx.Provider>
  );
}
