import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { desenhoWidget } from './CasaWidget';
import { lerResumo, resumoDoServidor } from './dados';

// Chamado pelo Android quando o widget é posto na tela, redimensionado ou na atualização de hora em
// hora (com o app aberto ou fechado). Os toques abrem o app direto (OPEN_APP / OPEN_URI).

registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, renderWidget }) => {
  if (widgetAction === 'WIDGET_DELETED' || widgetAction === 'WIDGET_CLICK') return;
  const salvo = await lerResumo();
  renderWidget(desenhoWidget(salvo, widgetInfo.height));
  if (salvo && widgetAction === 'WIDGET_UPDATE') {
    const novo = await resumoDoServidor(salvo);
    if (novo !== salvo) renderWidget(desenhoWidget(novo, widgetInfo.height));
  }
});
