import { Linking, Platform, Share } from 'react-native';

// Mandar um texto: no celular abre o "Compartilhar" do sistema (WhatsApp, Telegram, e-mail…);
// no navegador usa o compartilhar do celular quando existe, senão abre o WhatsApp Web com o texto.
export async function compartilhar(texto: string) {
  if (Platform.OS !== 'web') {
    await Share.share({ message: texto });
    return;
  }
  const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }) : null;
  if (nav?.share) {
    try { await nav.share({ text: texto }); return; } catch (e: any) { if (e?.name === 'AbortError') return; }
  }
  await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(texto)}`);
}
