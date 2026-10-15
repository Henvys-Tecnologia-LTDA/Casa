import { useState } from 'react';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { friendlyError, supabase } from '@/lib/supabase';
import { Btn, Card, ErrText, Field, Muted, Note, Seg, Txt } from '@/ui/kit';
import { C, F } from '@/ui/theme';

// Entrar ou criar conta com e-mail e senha (Supabase Auth).
export function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'entrar' | 'criar'>('entrar');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setErr(''); setInfo('');
    const em = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { setErr('Escreva um e-mail válido.'); return; }
    if (pass.length < 6) { setErr('A senha precisa ter pelo menos 6 caracteres.'); return; }
    if (mode === 'criar' && !name.trim()) { setErr('Escreva seu nome.'); return; }
    setBusy(true);
    try {
      if (mode === 'entrar') {
        const { error } = await supabase.auth.signInWithPassword({ email: em, password: pass });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: em, password: pass, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (!data.session) {
          setInfo('Conta criada. Enviamos um e-mail de confirmação: abra o link e depois volte aqui para entrar.');
          setMode('entrar');
        }
      }
    } catch (e) {
      setErr(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <KeyboardAwareScrollView bottomOffset={30} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, paddingTop: insets.top + 30, paddingBottom: insets.bottom + 30, gap: 22, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <View style={{ gap: 6 }}>
          <Txt w="medium" size={11.5} color={C.coral} upper track={3.2}>Planejamento a dois</Txt>
          <Text style={{ fontFamily: F.medium, fontSize: 40, lineHeight: 46, color: C.ink, letterSpacing: -1.4 }}>
            Casa a <Text style={{ fontFamily: F.serif, fontSize: 46, color: C.coral }}>Dois</Text> <Text style={{ fontSize: 30 }}>❤️</Text>
          </Text>
          <Muted>Compras da casa, o apê, a mudança, as viagens e as metas de vocês dois, sincronizados nos dois celulares.</Muted>
        </View>
        <Card pad={18} style={{ gap: 14 }}>
          <Seg value={mode} onChange={v => { setMode(v); setErr(''); }} options={[['entrar', 'Entrar'], ['criar', 'Criar conta']]} />
          {mode === 'criar' ? <Field label="Seu nome" value={name} onChangeText={setName} placeholder="Ex.: Camila" autoCapitalize="words" /> : null}
          <Field label="E-mail" value={email} onChangeText={setEmail} placeholder="voce@email.com" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Senha" value={pass} onChangeText={setPass} placeholder="Pelo menos 6 caracteres" secure onSubmit={submit} autoCapitalize="none" />
          <ErrText msg={err} />
          {info ? <Note>{info}</Note> : null}
          <Btn label={mode === 'entrar' ? 'Entrar' : 'Criar conta'} onPress={submit} busy={busy} />
        </Card>
        <Muted size={12.5} style={{ textAlign: 'center' }}>Cada casal só vê os próprios dados.</Muted>
      </KeyboardAwareScrollView>
    </View>
  );
}
