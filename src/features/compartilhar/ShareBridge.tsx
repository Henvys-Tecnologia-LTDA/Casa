// No navegador, o que vem de outro app chega pela rota /compartilhar (Web Share Target do site
// instalado); o recebimento direto só existe no Android (ShareBridge.android.tsx).
export function ShareBridge() {
  return null;
}
