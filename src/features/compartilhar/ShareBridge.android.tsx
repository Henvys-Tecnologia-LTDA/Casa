import { useShareIntent } from 'expo-share-intent';
import { useEffect } from 'react';

import { useSheets } from '../sheetsCtx';

// Android: quando alguém toca em Compartilhar em outro app (Amazon, Instagram, WhatsApp) e escolhe o
// Casa a Dois, abre a janela "Guardar no Casa a Dois" com o link ou o texto.
export function ShareBridge() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();
  const sheets = useSheets();
  useEffect(() => {
    if (!hasShareIntent) return;
    sheets.open({ kind: 'compartilhado', text: shareIntent.text ?? '', url: shareIntent.webUrl ?? '', title: shareIntent.meta?.title ?? '' });
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent, sheets]);
  return null;
}
