import { requestWidgetUpdate } from 'react-native-android-widget';

import type { ResumoWidget } from '@/lib/widget';

import { desenhoWidget } from './CasaWidget';
import { gravarResumo } from './dados';

// Com o app aberto: grava o resumo e redesenha o widget, só quando algo que ele mostra mudou.

let ultimo: string | undefined;

export function atualizarWidget(r: ResumoWidget | null) {
  const chave = r ? JSON.stringify({ ...r, em: '' }) : '';
  if (chave === ultimo) return;
  ultimo = chave;
  gravarResumo(r)
    .then(() => requestWidgetUpdate({ widgetName: 'Casa', renderWidget: info => desenhoWidget(r, info.height) }))
    .catch(() => {});
}
