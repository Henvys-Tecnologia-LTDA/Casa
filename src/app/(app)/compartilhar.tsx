import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { useSheets } from '@/features/sheetsCtx';

// Site instalado no Android (Web Share Target, public/manifest.json): o link compartilhado de outro app
// chega aqui e abre a janela "Guardar no Casa a Dois" por cima da aba Casa.
export default function Compartilhar() {
  const p = useLocalSearchParams<{ title?: string; text?: string; url?: string }>();
  const sheets = useSheets();
  const text = String(p.text ?? ''), url = String(p.url ?? ''), title = String(p.title ?? '');
  useEffect(() => {
    router.replace('/casa');
    if (text || url || title) sheets.open({ kind: 'compartilhado', text, url, title });
  }, [text, url, title, sheets]);
  return null;
}
