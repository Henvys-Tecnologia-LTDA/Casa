import { File } from 'expo-file-system';
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
