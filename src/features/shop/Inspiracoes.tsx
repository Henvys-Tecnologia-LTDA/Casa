import { useState } from 'react';
import { Linking, Pressable, ScrollView, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { hostOf, normLink, safeUrl } from '@/lib/format';
import type { Inspiration } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { AccentCtx, Btn, ErrText, Field, Muted, Txt, useAccent } from '@/ui/kit';
import { Photo } from '@/ui/Photo';
import { PhotoZone, usePhotoDraft } from '@/ui/PhotoZone';
import { Sheet, Spacer } from '@/ui/Sheet';
import { ACCENT, C, R, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { useApagar } from '@/ui/useApagar';

import { useSheets } from '../sheetsCtx';

// Mural de inspirações do cômodo (como um quadro do Miro ou uma pasta do Pinterest): prints, fotos e
// links de ideias antes de virarem item da lista. Vazio, é só um botão no topo do cômodo.

export const inspDe = (list: Inspiration[], secId: string) =>
  list.filter(x => x.section_id === secId).sort((a, b) => (a.sort_order - b.sort_order) || a.created_at.localeCompare(b.created_at));

export function BotaoInspiracoes({ secId }: { secId: string }) {
  const sheets = useSheets();
  return <Btn label="Inspirações" kind="ghost" size="sm" icon="image" onPress={() => sheets.open({ kind: 'inspiration', secId, insp: null })} />;
}

export function MuralInspiracoes({ secId }: { secId: string }) {
  const d = useData();
  const sheets = useSheets();
  const accent = useAccent();
  const list = inspDe(d.t.inspirations, secId);
  if (!list.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <Txt w="semibold" size={12.5} color={C.muted} upper track={1.2}>{`Inspirações (${list.length})`}</Txt>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {list.map(x => (
          <Pressable key={x.id} onPress={() => sheets.open({ kind: 'inspiration', secId, insp: x })} accessibilityLabel={x.note || 'Inspiração'}
            style={({ pressed }) => ({ width: 92, gap: 4, opacity: pressed ? 0.75 : 1 })}>
            <Photo path={x.image} icon={safeUrl(x.link) ? 'ext' : 'image'} style={{ width: 92, height: 92, borderRadius: R.icon, borderWidth: 1, borderColor: C.line }} />
            <Muted size={11.5} lines={1}>{x.note || hostOf(safeUrl(x.link)) || ' '}</Muted>
          </Pressable>
        ))}
        <Pressable onPress={() => sheets.open({ kind: 'inspiration', secId, insp: null })} accessibilityLabel="Nova inspiração"
          style={({ pressed }) => ({ width: 92, height: 92, borderRadius: R.icon, borderWidth: 1, borderStyle: 'dashed', borderColor: pressed ? C.ink : C.line, alignItems: 'center', justifyContent: 'center', backgroundColor: soft(accent) })}>
          <Icon name="plus" color={accent} />
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function InspirationSheet({ secId, insp, onClose }: { secId: string; insp: Inspiration | null; onClose: () => void }) {
  const d = useData();
  const { insert, update, remove, hid } = useActions();
  const apagar = useApagar();
  const toast = useToast();
  const sec = d.secById(secId);
  const photo = usePhotoDraft(insp?.image || '');
  const [link, setLink] = useState(insp?.link || '');
  const [note, setNote] = useState(insp?.note || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const l = link.trim() ? normLink(link) : '';
    if (link.trim() && !l) { setErr('O link não parece um endereço de site.'); return; }
    if (!photo.preview && !l && !note.trim()) { setErr('Ponha uma foto, um link ou uma anotação.'); return; }
    setBusy(true);
    try {
      const image = await photo.result(hid);
      const data: Partial<Inspiration> = { section_id: secId, image, link: l, note: note.trim() };
      if (insp) await update('inspirations', insp.id, data);
      else await insert('inspirations', { ...data, sort_order: inspDe(d.t.inspirations, secId).length });
      onClose();
      toast(insp ? 'Inspiração salva' : `Inspiração em ${sec?.name || 'cômodo'}`, 'image');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  // Vira item da lista com a foto e o link; a inspiração sai do mural (a foto fica com o item).
  async function virarItem() {
    if (!insp) return;
    try {
      const it = await insert('items', { section_id: secId, name: insp.note || 'Ideia do mural', image: insp.image, link: insp.link });
      await remove('inspirations', insp.id);
      onClose();
      toast(`“${it.name}” na lista`, 'plus');
    } catch (e: any) { setErr(e?.message || 'Não foi possível criar o item.'); }
  }

  const url = safeUrl(insp?.link);
  return (
    <AccentCtx.Provider value={ACCENT.casa}>
      <Sheet visible onClose={onClose} title={insp ? 'Inspiração' : 'Nova inspiração'} footer={<>
        {insp ? <Btn label="Apagar" kind="danger" icon="trash" onPress={async () => { try { await apagar('inspirations', insp.id, 'Inspiração apagada', [insp.image]); onClose(); } catch (e: any) { setErr(e?.message || ''); } }} /> : null}
        <Spacer />
        {insp ? <Btn label="Virar item" kind="ghost" icon="plus" onPress={virarItem} /> : null}
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <PhotoZone draft={photo} hint="Print do Pinterest, foto de uma loja, uma ideia que viram." />
        <Field label="Link (opcional)" value={link} onChangeText={setLink} placeholder="https://" autoCapitalize="none" keyboardType="url" />
        {url ? <View style={{ alignSelf: 'flex-start', marginTop: -6 }}><Btn label={`Abrir ${hostOf(url)}`} kind="ghost" size="xs" icon="ext" onPress={() => Linking.openURL(url)} /></View> : null}
        <Field label="Anotação (opcional)" value={note} onChangeText={setNote} placeholder="Ex.: sofá cinza com chaise" maxLength={300} />
        <ErrText msg={err || photo.err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
