import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Share, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { useSession } from '@/data/session';
import { fmtInput, parsePrice } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { MoneyField } from '@/ui/fields';
import { Btn, Chip, ErrText, Field, Grid2, Hint, Muted, Panel, Serif, Txt } from '@/ui/kit';
import { BackBar, Screen } from '@/ui/Screen';
import { useConfirm } from '@/ui/Sheet';
import { C, F } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// Ajustes do casal (nomes, renda, tetos) + convite, membros, trocar de casal e sair.
export function SettingsScreen() {
  const d = useData();
  const { updateHousehold, updateMyName, regenerateInvite, me, hid } = useActions();
  const { session, memberships, setCurrentId, signOut, refreshMemberships } = useSession();
  const toast = useToast();
  const confirm = useConfirm();
  const h = d.household;
  const myRow = d.members.find(m => m.user_id === me);

  const [coupleName, setCoupleName] = useState(h?.name || '');
  const [a, setA] = useState(h?.name_a || '');
  const [b, setB] = useState(h?.name_b || '');
  const [renda, setRenda] = useState(h?.renda ? fmtInput(h.renda) : '');
  const [budCasa, setBudCasa] = useState(h?.budget_casa ? fmtInput(h.budget_casa) : '');
  const [budSwitch, setBudSwitch] = useState(h?.budget_switch ? fmtInput(h.budget_switch) : '');
  const [myName, setMyName] = useState(myRow?.display_name || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    const nums = [renda, budCasa, budSwitch].map(v => (v.trim() ? parsePrice(v) : 0));
    if (nums.some(n => n == null)) { setErr('Algum valor está inválido. Use algo como 12.000.'); return; }
    setBusy(true); setErr('');
    try {
      await updateHousehold({
        name: coupleName.trim() || h?.name || 'Casal',
        name_a: a.trim() || 'Pessoa 1', name_b: b.trim() || 'Pessoa 2',
        renda: nums[0]!, budget_casa: nums[1]!, budget_switch: nums[2]!,
      });
      if (myName.trim() !== (myRow?.display_name || '')) await updateMyName(myName);
      refreshMemberships();
      toast('Ajustes salvos');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  const code = h?.invite_code || '';
  const shareText = `Entre no nosso planejamento “${h?.name || 'Casa'}”: instale o app Casa a Dois, crie sua conta e use o código de convite ${code}.`;

  async function leave() {
    const ok = await confirm({
      title: `Sair de “${h?.name || 'este casal'}”?`,
      text: 'Você deixa de ver os dados deste casal neste e nos outros aparelhos. Para voltar, precisa do código de convite.',
      yes: 'Sair do casal',
    });
    if (!ok) return;
    const { error } = await supabase.from('household_members').delete().eq('household_id', hid).eq('user_id', me);
    if (error) { toast('Não foi possível sair agora.', 'x'); return; }
    const rest = await refreshMemberships();
    setCurrentId(rest.find(m => m.household_id !== hid)?.household_id ?? null);
    router.replace('/');
  }

  return (
    <Screen tab="casa" inTabs={false}>
      <BackBar label="Voltar" />
      <Serif size={34}>Ajustes do casal</Serif>

      <Panel title="Nomes" icon="users">
        <Field label="Nome do casal (aparece na lista de casais)" value={coupleName} onChangeText={setCoupleName} placeholder="Ex.: Camila e Luis" />
        <Grid2>
          <Field label="Pessoa 1" value={a} onChangeText={setA} />
          <Field label="Pessoa 2" value={b} onChangeText={setB} />
        </Grid2>
        <Field label="Seu nome (aparece em “comprado por…”)" value={myName} onChangeText={setMyName} placeholder="Ex.: Luis" />
      </Panel>

      <Panel title="Dinheiro" icon="wallet">
        <MoneyField label="Renda mensal do casal (R$)" value={renda} onChange={setRenda} placeholder="Ex.: 12.000"
          hint="Serve para calcular quanto da renda a parcela do apê compromete. Os bancos costumam aceitar até 30%." />
        <Grid2>
          <MoneyField label="Teto de gastos da Casa (R$)" value={budCasa} onChange={setBudCasa} placeholder="Ex.: 45.000" />
          <MoneyField label="Teto de gastos do Switch 2 (R$)" value={budSwitch} onChange={setBudSwitch} placeholder="Ex.: 3.000" />
        </Grid2>
        <ErrText msg={err} />
        <View style={{ alignSelf: 'flex-start' }}><Btn label="Salvar ajustes" onPress={save} busy={busy} /></View>
      </Panel>

      <Panel title="Convidar para este casal" icon="heart">
        <Muted>Quem entrar com este código vê e edita tudo deste casal, em tempo real. Mande só para o seu par.</Muted>
        <View style={{ alignItems: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line }}>
          <Txt w="medium" size={30} style={{ letterSpacing: 6, fontFamily: F.medium }} lines={1}>{code || '—'}</Txt>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Btn label="Copiar" kind="ghost" size="sm" icon="copy" onPress={async () => { await Clipboard.setStringAsync(code); toast('Código copiado'); }} />
          {Platform.OS !== 'web' ? <Btn label="Enviar" kind="ghost" size="sm" icon="share" onPress={() => Share.share({ message: shareText })} /> : null}
          <Btn label="Gerar novo código" kind="ghost" size="sm" icon="refresh" onPress={async () => {
            const ok = await confirm({ title: 'Gerar um novo código?', text: 'O código atual para de funcionar. Quem já entrou continua no casal.', yes: 'Gerar novo' });
            if (!ok) return;
            try { await regenerateInvite(); toast('Novo código gerado'); } catch (e: any) { toast(e?.message || 'Erro', 'x'); }
          }} />
        </View>
        <Txt w="semibold" size={12.5} color={C.muted} style={{ marginTop: 4 }}>Quem está neste casal</Txt>
        {d.members.map(m => (
          <View key={m.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: C.ok }} />
            <Txt>{m.display_name || 'Sem nome'}{m.user_id === me ? ' (você)' : ''}</Txt>
          </View>
        ))}
      </Panel>

      <Panel title="Seus casais" icon="house">
        <Hint>Cada casal tem os próprios dados. Um não vê nada do outro.</Hint>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {memberships.map(m => (
            <Chip key={m.household_id} label={m.name} on={m.household_id === hid} onPress={() => {
              if (m.household_id === hid) return;
              setCurrentId(m.household_id);
              router.replace('/casa');
            }} />
          ))}
        </View>
        <View style={{ alignSelf: 'flex-start' }}>
          <Btn label="Criar ou entrar em outro casal" kind="ghost" size="sm" icon="plus" onPress={() => router.push('/casal?outro=1')} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
          <Btn label="Sair deste casal" kind="danger" size="sm" onPress={leave} />
        </View>
      </Panel>

      <Panel title="Conta" icon="logout">
        <Muted>{session?.user.email ? `Conectado como ${session.user.email}` : ''}</Muted>
        <View style={{ alignSelf: 'flex-start' }}>
          <Btn label="Sair da conta" kind="ghost" size="sm" icon="logout" onPress={async () => { await signOut(); router.replace('/login'); }} />
        </View>
      </Panel>
    </Screen>
  );
}
