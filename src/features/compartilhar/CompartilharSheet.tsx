import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { hostOf } from '@/lib/format';
import { lerLink } from '@/lib/link';
import { lerItem, secaoDe } from '@/lib/mercado';
import type { ShopList } from '@/lib/types';
import { AccentCtx, Btn, Chip, ErrText, Muted, Seg, Txt } from '@/ui/kit';
import { Sheet, Spacer } from '@/ui/Sheet';
import { ACCENT, C, R } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { useSheets } from '../sheetsCtx';

// "Compartilhar com o Casa a Dois" (como o Pinterest e o Pocket): o link ou o texto que veio de outro
// app (Amazon, Instagram, WhatsApp) vira item da lista, inspiração do cômodo ou itens do mercado.

type Destino = 'item' | 'inspiracao' | 'mercado';

export function CompartilharSheet({ text, url: url0, title, onClose }: { text: string; url: string; title: string; onClose: () => void }) {
  const d = useData();
  const sheets = useSheets();
  const { insert } = useActions();
  const toast = useToast();
  const url = url0 || text.match(/https?:\/\/[^\s<>"']+/i)?.[0] || '';
  const resto = (url ? text.replace(url, '') : text).trim();
  const [dest, setDest] = useState<Destino>(url ? 'item' : 'mercado');
  const [list, setList] = useState<ShopList>('casa');
  const [sec, setSec] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const listas: ShopList[] = (['casa', 'switch'] as const).filter(l => !d.tabs[l].hidden);
  const L = dest === 'inspiracao' ? 'casa' : list;
  const secs = d.secs(L);
  const secId = secs.some(s => s.id === sec) ? sec : secs[0]?.id || '';
  const mercado = (resto || title).split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 30);

  async function continuar() {
    setErr('');
    try {
      if (dest === 'mercado') {
        if (!mercado.length) { setErr('Não veio nenhum texto para pôr no mercado.'); return; }
        setBusy(true);
        for (const p of mercado) { const { text: t, qty } = lerItem(p); await insert('groceries', { text: t.slice(0, 120), qty: qty.slice(0, 30), cat: secaoDe(t) }); }
        onClose();
        toast(mercado.length === 1 ? '1 item no mercado' : `${mercado.length} itens no mercado`, 'cart');
        router.push('/mercado');
        return;
      }
      if (!secId) { setErr('Criem um cômodo primeiro.'); return; }
      if (dest === 'inspiracao') {
        setBusy(true);
        await insert('inspirations', { section_id: secId, link: url, note: (title || resto).slice(0, 300) });
        onClose();
        toast('Inspiração guardada', 'image');
        router.push({ pathname: '/section/[id]', params: { id: secId } });
        return;
      }
      // Item: lê a página (nome, preço, foto e loja) e abre o editor já preenchido para conferir.
      setBusy(true);
      const info = url ? await lerLink(url).catch(() => null) : null;
      sheets.open({
        kind: 'item', item: null, secId, list,
        pre: { name: (info?.title || title || resto).slice(0, 120), price: info?.price ?? undefined, store: info?.store || '', link: info?.url || url, image: info?.image || '' },
      });
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível guardar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccentCtx.Provider value={dest === 'mercado' ? C.ok : ACCENT[L]}>
      <Sheet visible onClose={onClose} title="Guardar no Casa a Dois" footer={<>
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label={dest === 'item' ? 'Continuar' : 'Guardar'} onPress={continuar} busy={busy} />
      </>}>
        <View style={{ padding: 12, borderRadius: R.card, backgroundColor: C.bg, gap: 2 }}>
          {title ? <Txt w="semibold" lines={2}>{title}</Txt> : null}
          {url ? <Muted size={13} lines={1}>{hostOf(url) || url}</Muted> : null}
          {!url && resto ? <Muted size={13} lines={3}>{resto}</Muted> : null}
        </View>
        <Seg label="Guardar como" value={dest} onChange={setDest} options={[['item', 'Item da lista'], ['inspiracao', 'Inspiração'], ['mercado', 'Mercado']]} />
        {dest === 'item' && listas.length > 1 ? (
          <Seg label="Lista" value={list} onChange={v => { setList(v); setSec(''); }} options={listas.map(l => [l, d.tabLabel(l)] as [ShopList, string])} />
        ) : null}
        {dest !== 'mercado' ? (
          secs.length ? (
            <View style={{ gap: 6 }}>
              <Txt w="semibold" size={12.5} color={C.muted}>{L === 'casa' ? 'Cômodo' : 'Seção'}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {secs.map(s => <Chip key={s.id} label={s.name} icon={s.icon || 'box'} on={secId === s.id} onPress={() => setSec(s.id)} />)}
              </View>
            </View>
          ) : <Muted size={13}>{`Ainda não há ${L === 'casa' ? 'cômodos' : 'seções'} em ${d.tabLabel(L)}. Criem um na aba e compartilhem de novo.`}</Muted>
        ) : (
          <Muted size={13}>{mercado.length ? `Vai pôr no mercado: ${mercado.slice(0, 6).join(', ')}${mercado.length > 6 ? '…' : ''}` : 'Nada para pôr no mercado.'}</Muted>
        )}
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
