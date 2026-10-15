import { useEffect, useState } from 'react';
import { Linking, Platform, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { enablePush, pushState, type PushState } from '@/lib/push';
import { TAB_ORDER } from '@/lib/tabs';
import type { TabKey } from '@/lib/types';
import { Icon } from '@/ui/Icon';
import { Btn, Chip, Hint, Muted, Panel, Toggle, Txt } from '@/ui/kit';
import { ACCENT, C, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// O que cada aba avisa: "novo" (adicionou) e "feito" (comprou, concluiu, mudou de status, depositou).
// Tem que bater com os gatilhos de supabase/migrations/*_push_notifications.sql.
const KINDS: Record<TabKey, { novo: string; feito: string }> = {
  casa: { novo: 'Itens novos', feito: 'Comprados' },
  switch: { novo: 'Itens novos', feito: 'Comprados' },
  ape: { novo: 'Apês novos', feito: 'Mudou de status' },
  mudanca: { novo: 'Tarefas novas', feito: 'Concluídas' },
  viagem: { novo: 'Viagens e custos', feito: 'Cofrinho' },
  dinheiro: { novo: 'Metas novas', feito: 'Depósitos' },
};

// Avisos: ligar neste aparelho + o que cada pessoa quer receber neste casal.
export function NotifyPanel() {
  const d = useData();
  const { updateMyNotify } = useActions();
  const toast = useToast();
  const mine = d.members.find(m => m.user_id === d.me);
  const off = new Set(mine?.notify_off ?? []);
  const paused = !!mine?.notify_paused;
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    pushState().then(s => { if (alive) setState(s); }).catch(() => { if (alive) setState('error'); });
    return () => { alive = false; };
  }, []);

  async function enable() {
    setBusy(true);
    const s = await enablePush();
    setState(s);
    setBusy(false);
    if (s === 'on') toast('Avisos ligados neste aparelho', 'bell');
  }

  async function save(patch: Parameters<typeof updateMyNotify>[0]) {
    try { await updateMyNotify(patch); } catch (e: any) { toast(e?.message || 'Não foi possível salvar.', 'x'); }
  }

  function flip(key: string) {
    const next = new Set(off);
    if (next.has(key)) next.delete(key); else next.add(key);
    save({ notify_off: [...next] });
  }

  return (
    <Panel title="Avisos" icon="bell">
      <DeviceState state={state} busy={busy} onEnable={enable} />
      <Toggle label="Pausar todos os meus avisos" value={paused} onChange={v => save({ notify_paused: v })} />
      <View style={{ borderWidth: 1, borderColor: C.line, borderRadius: 3, overflow: 'hidden', opacity: paused ? 0.45 : 1 }}
        pointerEvents={paused ? 'none' : 'auto'}>
        {TAB_ORDER.filter(k => !d.tabs[k].hidden).map((k, i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.line, backgroundColor: C.surface }}>
            <View style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: soft(ACCENT[k]), alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={d.tabs[k].icon} size={20} color={ACCENT[k]} />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Txt w="semibold">{d.tabs[k].label}</Txt>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {(['novo', 'feito'] as const).map(kind => (
                  <Chip key={kind} label={KINDS[k][kind]} on={!off.has(`${k}:${kind}`)} onPress={() => flip(`${k}:${kind}`)} />
                ))}
              </View>
            </View>
          </View>
        ))}
      </View>
      <Hint>Cada um escolhe os próprios avisos, e ninguém é avisado do que fez. Várias mudanças seguidas chegam juntas, cerca de 1 minuto depois.</Hint>
    </Panel>
  );
}

function DeviceState({ state, busy, onEnable }: { state: PushState | null; busy: boolean; onEnable: () => void }) {
  if (!state) return null;
  const web = Platform.OS === 'web';
  const line = (icon: string, color: string, text: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Icon name={icon} size={16} color={color} />
      <Muted size={13.5} style={{ flex: 1 }}>{text}</Muted>
    </View>
  );
  const button = (label: string) => (
    <View style={{ alignSelf: 'flex-start' }}><Btn label={label} kind="ghost" size="sm" icon="bell" busy={busy} onPress={onEnable} /></View>
  );
  switch (state) {
    case 'on':
      return line('check', C.ok, web ? 'Avisos ligados neste navegador.' : 'Avisos ligados neste celular.');
    case 'off':
      return <>{line('bell', C.muted, 'Este aparelho ainda não recebe avisos.')}{button('Ativar neste aparelho')}</>;
    case 'error':
      return <>{line('alert', C.hi, 'Não deu para ligar os avisos agora. Confira a internet e tente de novo.')}{button('Tentar de novo')}</>;
    case 'denied':
      return web
        ? line('alert', C.hi, 'O navegador bloqueou os avisos deste site. Libere nas configurações do navegador.')
        : (
          <>
            {line('alert', C.hi, 'Os avisos estão bloqueados nas configurações do celular.')}
            <View style={{ alignSelf: 'flex-start' }}>
              <Btn label="Abrir configurações" kind="ghost" size="sm" icon="sliders" onPress={() => Linking.openSettings()} />
            </View>
          </>
        );
    case 'install':
      return line('info', C.muted,
        'No iPhone, os avisos chegam pelo app na Tela de Início: no Safari, toque em Compartilhar → Adicionar à Tela de Início, abra o Casa a Dois por lá e ative aqui (iOS 16.4 ou mais novo).');
    case 'unsupported':
      return line('info', C.muted, 'Este navegador não recebe avisos.');
  }
}
