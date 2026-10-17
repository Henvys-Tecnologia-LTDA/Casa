import { Hint, Panel, Seg } from '@/ui/kit';
import { definirTema, type Tema, useTema } from '@/ui/theme';

// Aparência deste aparelho: automático (segue o celular ou o computador), claro ou escuro.
// Cada um escolhe no seu; a escolha não vai para o outro.

const OPCOES: [Tema, string][] = [['auto', 'Automático'], ['claro', 'Claro'], ['escuro', 'Escuro']];

export function TemaPanel() {
  const { escolha } = useTema();
  return (
    <Panel title="Aparência" icon={escolha === 'claro' ? 'sun' : 'moon'}>
      <Seg value={escolha} options={OPCOES} onChange={definirTema} />
      <Hint>Vale só para este aparelho. No automático, o app segue o tema do celular ou do computador.</Hint>
    </Panel>
  );
}
