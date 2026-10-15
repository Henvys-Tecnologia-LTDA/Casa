import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSession } from '@/data/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { Btn, Card, ErrText, Field, Grid2, Muted, Serif, Txt } from '@/ui/kit';
import { BackBar } from '@/ui/Screen';
import { C } from '@/ui/theme';

// Criar um casal novo ou entrar num casal com o código de convite.
export function CoupleScreen({ another }: { another?: boolean }) {
  const insets = useSafeAreaInsets();
  const { session, memberships, refreshMemberships, setCurrentId, signOut } = useSession();
  const meta = (session?.user.user_metadata || {}) as { name?: string };
  const myDefault = String(meta.name || '').trim();
  const [myName, setMyName] = useState(myDefault);
  const [coupleName, setCoupleName] = useState('');
  const [a, setA] = useState(myDefault);
  const [b, setB] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<'' | 'create' | 'join'>('');

  async function done(hid: string) {
    await refreshMemberships();
    setCurrentId(hid);
    router.replace('/casa');
  }

  async function create() {
    setErr('');
    const n = coupleName.trim() || [a.trim(), b.trim()].filter(Boolean).join(' e ');
    if (!n) { setErr('Dê um nome ao casal, como “Camila e Luis”.'); return; }
    setBusy('create');
    try {
      const { data, error } = await supabase.rpc('create_household', { p_name: n, p_name_a: a.trim(), p_name_b: b.trim(), p_display_name: myName.trim() });
      if (error) throw error;
      await done((data as any).id);
    } catch (e) { setErr(friendlyError(e)); } finally { setBusy(''); }
  }

  async function join() {
    setErr('');
    if (code.replace(/[^A-Za-z0-9]/g, '').length < 6) { setErr('Escreva o código de convite que o seu par mandou.'); return; }
    setBusy('join');
    try {
      const { data, error } = await supabase.rpc('join_household', { p_code: code, p_display_name: myName.trim() });
      if (error) throw error;
      await done((data as any).id);
    } catch (e) { setErr(friendlyError(e)); } finally { setBusy(''); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingTop: insets.top + 18, paddingBottom: insets.bottom + 40, gap: 18, maxWidth: 560, width: '100%', alignSelf: 'center' }}>
        {another && memberships.length ? <BackBar label="Voltar" /> : null}
        <View style={{ gap: 4 }}>
          <Txt w="medium" size={11.5} color={C.coral} upper track={3.2}>Planejamento a dois</Txt>
          <Serif size={38}>{another ? 'Outro casal' : 'O casal de vocês'}</Serif>
          <Muted>Um de vocês cria o casal e manda o código de convite para o outro. Cada casal só vê os próprios dados.</Muted>
        </View>
        <Field label="Seu nome" value={myName} onChangeText={setMyName} placeholder="Ex.: Luis" autoCapitalize="words" />

        <Card pad={18} style={{ gap: 12 }}>
          <Txt w="medium" size={18}>Criar um casal</Txt>
          <Grid2>
            <Field label="Pessoa 1" value={a} onChangeText={setA} placeholder="Ex.: Camila" autoCapitalize="words" />
            <Field label="Pessoa 2" value={b} onChangeText={setB} placeholder="Ex.: Luis" autoCapitalize="words" />
          </Grid2>
          <Field label="Nome do casal (opcional)" value={coupleName} onChangeText={setCoupleName} placeholder={[a.trim(), b.trim()].filter(Boolean).join(' e ') || 'Ex.: Camila e Luis'} />
          <Btn label="Criar casal" icon="plus" onPress={create} busy={busy === 'create'} />
        </Card>

        <Card pad={18} style={{ gap: 12 }}>
          <Txt w="medium" size={18}>Entrar com um código</Txt>
          <Field label="Código de convite" value={code} onChangeText={v => setCode(v.toUpperCase())} placeholder="Ex.: K7M2Q9XA" autoCapitalize="characters" maxLength={12} />
          <Btn label="Entrar no casal" kind="ghost" icon="heart" onPress={join} busy={busy === 'join'} />
        </Card>
        <ErrText msg={err} />
        <View style={{ alignSelf: 'center' }}>
          <Btn label="Sair da conta" kind="ghost" size="sm" icon="logout" onPress={async () => { await signOut(); router.replace('/login'); }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
