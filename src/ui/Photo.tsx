import { File, Paths } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Platform, View, type StyleProp, type ViewStyle } from 'react-native';

import { PHOTOS_BUCKET } from '@/lib/config';
import { uuid } from '@/lib/format';
import { supabase } from '@/lib/supabase';

import { Icon } from './Icon';
import { editPhoto, type EditOpts } from './PhotoEditor';
import type { Picked } from './photoEdit';
import { renderPhoto } from './photoRender';
import { C } from './theme';

export type { Picked };

// Fotos ficam no bucket privado "photos", em "<casal>/<arquivo>.jpg".
// Para mostrar, pedimos uma URL assinada (vale 1 hora) e guardamos em memória.

const cache = new Map<string, { url: string; exp: number }>();
const inflight = new Map<string, Promise<string | null>>();

export async function signedUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && hit.exp > Date.now()) return hit.url;
  const running = inflight.get(path);
  if (running) return running;
  const p = (async () => {
    const { data, error } = await supabase.storage.from(PHOTOS_BUCKET).createSignedUrl(path, 3600);
    inflight.delete(path);
    if (error || !data?.signedUrl) return null;
    cache.set(path, { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 });
    return data.signedUrl;
  })();
  inflight.set(path, p);
  return p;
}

const isLocal = (p: string) => /^(file|content|blob|data|https?):/.test(p);
function cachedUrl(path: string): string | null {
  const hit = cache.get(path);
  return hit && hit.exp > Date.now() ? hit.url : null;
}

export function usePhotoUrl(path: string | null | undefined) {
  const [fetched, setFetched] = useState<{ path: string; url: string | null } | null>(null);
  const direct = !path ? null : isLocal(path) ? path : cachedUrl(path);
  useEffect(() => {
    if (!path || isLocal(path) || cachedUrl(path)) return;
    let alive = true;
    signedUrl(path).then(u => { if (alive) setFetched({ path, url: u }); });
    return () => { alive = false; };
  }, [path]);
  if (!path) return null;
  return direct ?? (fetched?.path === path ? fetched.url : null);
}

export function Photo({ path, style, icon = 'image', iconSize = 24, iconColor = C.muted, fit = 'cover', bg = C.sunken }: {
  path?: string | null; style?: StyleProp<ViewStyle>; icon?: string; iconSize?: number; iconColor?: string; fit?: 'cover' | 'contain'; bg?: string;
}) {
  const url = usePhotoUrl(path);
  return (
    <View style={[{ backgroundColor: bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, style]}>
      {url ? (
        <Image source={{ uri: url }} style={{ width: '100%', height: '100%' }} contentFit={fit} transition={180} cachePolicy="memory-disk" recyclingKey={path || undefined} />
      ) : (
        <Icon name={icon} size={iconSize} color={iconColor} />
      )}
    </View>
  );
}

// Escolhe da galeria (ou tira com a câmera) e abre o editor para cortar e girar.
// Devolve null se a pessoa desistiu, no seletor ou no editor.
export async function pickImage(source: 'library' | 'camera' = 'library', opts?: EditOpts): Promise<Picked | null> {
  let r: ImagePicker.ImagePickerResult;
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Sem permissão para usar a câmera. Libere nas configurações do celular.');
    r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
  } else {
    r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
  }
  if (r.canceled || !r.assets?.[0]) return null;
  const a = r.assets[0];
  return editPhoto({ uri: a.uri, width: a.width, height: a.height }, opts);
}

// Bytes de imagem com o tipo certo (a função ler-link devolve application/octet-stream).
async function asImage(b: Blob): Promise<Blob> {
  const h = new Uint8Array(await b.slice(0, 16).arrayBuffer());
  const txt = String.fromCharCode(...h);
  const type = h[0] === 0xff && h[1] === 0xd8 ? 'image/jpeg'
    : txt.startsWith('\x89PNG') ? 'image/png'
    : txt.startsWith('GIF8') ? 'image/gif'
    : txt.startsWith('RIFF') && txt.slice(8, 12) === 'WEBP' ? 'image/webp'
    : txt.slice(4, 12) === 'ftypavif' ? 'image/avif'
    : /^\s*<(\?xml|svg)/i.test(txt) ? 'image/svg+xml'
    : 'image/jpeg';
  return new Blob([b], { type });
}

/**
 * Uma foto que já está no app (no Supabase, num link de loja ou no aparelho) como arquivo local, para
 * abrir no editor. No celular, baixa para o cache; no navegador, lê direto e, se a loja não deixar
 * (CORS), pela função ler-link.
 */
export async function loadPhoto(src: string): Promise<Picked> {
  const url = isLocal(src) ? src : await signedUrl(src);
  if (!url) throw new Error('Não foi possível abrir esta foto.');
  if (!/^https?:/i.test(url)) return { uri: url, width: 0, height: 0 };
  if (Platform.OS !== 'web') {
    const file = await File.downloadFileAsync(url, new File(Paths.cache, `ajuste-${uuid()}.img`));
    return { uri: file.uri, width: 0, height: 0 };
  }
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (res.ok) {
      const b = await res.blob();
      if (b.type.startsWith('image/')) return { uri: URL.createObjectURL(b), width: 0, height: 0 };
    }
  } catch {}
  const { data, error } = await supabase.functions.invoke('ler-link', { body: { foto: url } });
  if (error || !(data instanceof Blob)) throw new Error('A loja não deixou baixar essa foto para ajustar.');
  return { uri: URL.createObjectURL(await asImage(data)), width: 0, height: 0 };
}

/**
 * Abre o editor na foto que está no formulário: a escolhida agora (a partir da original, com o último
 * ajuste) ou a que já estava salva ou veio do link. Devolve a foto nova, ou null se cancelaram ou se
 * nada mudou.
 */
export async function adjustPhoto(picked: Picked | null, current: string, opts?: EditOpts): Promise<Picked | null> {
  if (picked) return editPhoto(picked.source ?? picked, { ...opts, initial: picked.edit });
  if (!current) return null;
  const src = await loadPhoto(current);
  const out = await editPhoto(src, opts);
  return out && out !== src ? out : null;
}

// Envia para a pasta do casal. A foto que passou pelo editor já vem pronta (girada, cortada,
// no máximo 1200 px, JPEG); as outras são reduzidas aqui.
export async function uploadPhoto(hid: string, img: Picked): Promise<string> {
  const out = img.ready ? img : await renderPhoto(img);
  const body = Platform.OS === 'web'
    ? await (await fetch(out.uri)).arrayBuffer()
    : await new File(out.uri).arrayBuffer();
  const path = `${hid}/${uuid()}.jpg`;
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  cache.set(path, { url: out.uri, exp: Date.now() + 10 * 60 * 1000 });
  return path;
}

export function deletePhotos(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p && !/^(file|content|blob|data|https?):/.test(p));
  if (!list.length) return;
  for (const p of list) cache.delete(p);
  supabase.storage.from(PHOTOS_BUCKET).remove(list).catch(() => {});
}
