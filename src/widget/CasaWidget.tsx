'use no memo';
// A biblioteca do widget chama estes componentes como funções simples, fora do React: o React
// Compiler não pode mexer neste arquivo.

import { FlexWidget, SvgWidget, TextWidget, type HexColor } from 'react-native-android-widget';

import { linhasWidget, type ResumoWidget } from '@/lib/widget';
import { PALETA } from '@/ui/theme';

// Widget "Casa a Dois" na tela de início do Android: as tarefas da semana e quanto falta comprar
// em cada lista. Tocar abre o app na aba certa.

type Cores = (typeof PALETA)['claro'];

const marca = (c: Cores) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
<path d="M2.5 11 12 3.6l9.5 7.4" stroke="${c.ink}"/><path d="M5 9.4V20h14V9.4" stroke="${c.ink}"/>
<path d="M12 17.6c-2.4-1.5-3.3-2.8-3.3-4 0-1.05.78-1.85 1.75-1.85.7 0 1.25.38 1.55.95.3-.57.85-.95 1.55-.95.97 0 1.75.8 1.75 1.85 0 1.2-.9 2.5-3.3 4z" stroke="${c.coral}"/></svg>`;

const hex = (s: string) => s as HexColor;

/** Quantas linhas de tarefa cabem na altura do widget (em dp). */
export function cabem(height: number) {
  return Math.max(1, Math.min(6, Math.floor((height - 84) / 21)));
}

function Tela({ r, c, height }: { r: ResumoWidget | null; c: Cores; height: number }) {
  if (!r) {
    return (
      <FlexWidget
        clickAction="OPEN_APP"
        accessibilityLabel="Abrir o Casa a Dois"
        style={{ height: 'match_parent', width: 'match_parent', backgroundColor: hex(c.surface), borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', flexGap: 10 }}>
        <SvgWidget svg={marca(c)} style={{ height: 34, width: 34 }} />
        <TextWidget text="Entre no app para ver o resumo do casal" style={{ fontSize: 14, color: hex(c.muted) }} maxLines={2} truncate="END" />
      </FlexWidget>
    );
  }
  const linhas = r.tarefas ? linhasWidget(r, cabem(height)) : [];
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel="Abrir o Casa a Dois"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: hex(c.surface), borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'column', justifyContent: 'space-between' }}>
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: 8 }}>
        <SvgWidget svg={marca(c)} style={{ height: 22, width: 22 }} />
        <TextWidget text="Casa a Dois" style={{ fontSize: 15, fontWeight: '600', color: hex(c.ink) }} />
      </FlexWidget>

      {r.tarefas ? (
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'casaadois://mudanca' }}
          accessibilityLabel={`Abrir ${r.tarefasLabel}`}
          style={{ width: 'match_parent', flexDirection: 'column', flexGap: 3, paddingVertical: 6 }}>
          {linhas.length ? linhas.map((l, i) => (
            <FlexWidget key={i} style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', flexGap: 8 }}>
              <FlexWidget style={{ height: 6, width: 6, borderRadius: 3, backgroundColor: hex(l.atrasada ? c.hi : c.coral) }} />
              <TextWidget text={l.title} style={{ fontSize: 14, color: hex(c.ink) }} maxLines={1} truncate="END" />
              <TextWidget text={`· ${l.quando}`} style={{ fontSize: 12.5, color: hex(l.atrasada ? c.hi : c.muted) }} maxLines={1} />
            </FlexWidget>
          )) : (
            <TextWidget text="Nada com prazo nos próximos 7 dias" style={{ fontSize: 13.5, color: hex(c.muted) }} maxLines={1} truncate="END" />
          )}
        </FlexWidget>
      ) : null}

      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', flexGap: 14 }}>
        {r.listas.map(l => (
          <FlexWidget
            key={l.tab}
            clickAction="OPEN_URI"
            clickActionData={{ uri: `casaadois://${l.tab}` }}
            accessibilityLabel={`Abrir ${l.label}`}
            style={{ flexDirection: 'row', alignItems: 'center', flexGap: 4 }}>
            <TextWidget text={l.label} style={{ fontSize: 12.5, fontWeight: '600', color: hex(c.ink) }} maxLines={1} truncate="END" />
            <TextWidget text={l.faltam ? `faltam ${l.faltam}` : 'tudo comprado'} style={{ fontSize: 12.5, color: hex(c.muted) }} maxLines={1} />
          </FlexWidget>
        ))}
      </FlexWidget>
    </FlexWidget>
  );
}

/** O widget nos dois temas; o Android escolhe pelo tema do aparelho. */
export function desenhoWidget(r: ResumoWidget | null, height: number) {
  return {
    light: <Tela r={r} c={PALETA.claro} height={height} />,
    dark: <Tela r={r} c={PALETA.escuro} height={height} />,
  };
}
