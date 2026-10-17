import { useState } from 'react';
import { Platform, View } from 'react-native';

import { Btn, Muted } from './kit';
import { adjustPhoto, Photo, pickImage, uploadPhoto, type Picked } from './Photo';
import { C } from './theme';

// Rascunho de foto dentro de um formulário: escolhe, tira com a câmera, ajusta (corte e giro, também
// na foto que veio do link) ou remove; só envia ao Supabase quando o formulário é salvo.

export function usePhotoDraft(current: string) {
  const [picked, setPicked] = useState<Picked | null>(null);
  const [removed, setRemoved] = useState(false);
  const [err, setErr] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  // Foto que veio de um link colado (endereço da loja, sem enviar arquivo).
  const [url, setUrl] = useState('');
  const base = url || current;
  return {
    picked,
    removed,
    err,
    preview: picked?.uri || (removed ? '' : base),
    reset() { setPicked(null); setRemoved(false); setErr(''); setUrl(''); },
    setFromUrl(u: string) { setUrl(u); setPicked(null); setRemoved(false); },
    async pick(source: 'library' | 'camera') {
      try {
        setErr('');
        const p = await pickImage(source);
        if (p) { setPicked(p); setRemoved(false); }
      } catch (e: any) {
        setErr(e?.message || 'Não foi possível abrir as fotos.');
      }
    },
    adjusting,
    // Abre o editor na foto do formulário: a escolhida agora, a que veio do link ou a já salva
    // (estas duas são baixadas antes e, se mudarem, viram uma foto enviada ao salvar).
    async adjust() {
      if (adjusting) return;
      try {
        setErr(''); setAdjusting(true);
        const p = await adjustPhoto(picked, removed ? '' : base);
        if (p) { setPicked(p); setRemoved(false); }
      } catch (e: any) {
        setErr(e?.message || 'Não foi possível ajustar a foto.');
      } finally {
        setAdjusting(false);
      }
    },
    remove() { setPicked(null); setRemoved(true); },
    async result(hid: string): Promise<string> {
      if (picked) return uploadPhoto(hid, picked);
      return removed ? '' : base;
    },
  };
}
export type PhotoDraft = ReturnType<typeof usePhotoDraft>;

export function PhotoZone({ draft, icon = 'image', hint }: { draft: PhotoDraft; icon?: string; hint: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, backgroundColor: C.bg }}>
      <Photo path={draft.preview} icon={icon} iconSize={30} style={{ width: 88, height: 88, borderRadius: 8 }} />
      <View style={{ flex: 1, gap: 8 }}>
        <Muted size={13.5}>{draft.err || hint}</Muted>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn label="Galeria" kind="ghost" size="sm" icon="image" onPress={() => draft.pick('library')} />
          {Platform.OS !== 'web' ? <Btn label="Câmera" kind="ghost" size="sm" icon="camera" onPress={() => draft.pick('camera')} /> : null}
          {draft.preview ? <Btn label="Ajustar" kind="ghost" size="sm" icon="crop" busy={draft.adjusting} onPress={draft.adjust} /> : null}
          {draft.preview ? <Btn label="Remover" kind="danger" size="sm" onPress={draft.remove} /> : null}
        </View>
      </View>
    </View>
  );
}
