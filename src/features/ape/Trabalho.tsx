import { useState } from 'react';
import { Linking, Pressable, View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { AccentCtx, Btn, ErrText, Field, Hint, Txt } from '@/ui/kit';
import { Sheet, Spacer } from '@/ui/Sheet';
import { ACCENT, C } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

import { useSheets } from '../sheetsCtx';

// Tempo até o trabalho de cada um (como no QuintoAndar): abre a rota no Google Maps, de transporte
// público, do endereço do apê até o trabalho. Os endereços do trabalho ficam no casal.

const enc = encodeURIComponent;
export const rotaUrl = (de: string, para: string) =>
  `https://www.google.com/maps/dir/?api=1&origin=${enc(de)}&destination=${enc(para)}&travelmode=transit`;
/** Todos os endereços no mapa (um só: a busca; vários: uma rota passando por todos). */
export const mapaUrl = (enderecos: string[]) => (enderecos.length === 1
  ? `https://www.google.com/maps/search/?api=1&query=${enc(enderecos[0])}`
  : `https://www.google.com/maps/dir/${enderecos.map(enc).join('/')}`);

export function useTrabalhos() {
  const d = useData();
  const h = d.household;
  return ([['a', h?.work_a], ['b', h?.work_b]] as const)
    .filter(([, w]) => !!w?.trim())
    .map(([k, w]) => ({ k, nome: d.nm(k), endereco: w!.trim() }));
}

/** Botões "Até o trabalho de …" de um apê (ou um botão para cadastrar os trabalhos). */
export function AteOTrabalho({ address }: { address: string }) {
  const sheets = useSheets();
  const ts = useTrabalhos();
  if (!address.trim()) return null;
  if (!ts.length) return <View style={{ alignSelf: 'flex-start' }}><Btn label="Tempo até o trabalho" kind="ghost" size="xs" icon="mapPin" onPress={() => sheets.open({ kind: 'trabalho' })} /></View>;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {ts.map(t => <Btn key={t.k} label={`Até o trabalho de ${t.nome}`} kind="ghost" size="xs" icon="mapPin" onPress={() => Linking.openURL(rotaUrl(address, t.endereco))} />)}
    </View>
  );
}

/** Célula da comparação: um link por pessoa. */
export function TrabalhoCelula({ address }: { address: string }) {
  const ts = useTrabalhos();
  if (!address.trim()) return <Txt size={14} color={C.muted} style={{ textAlign: 'right' }}>sem endereço</Txt>;
  return (
    <View style={{ alignItems: 'flex-end', gap: 4 }}>
      {ts.map(t => (
        <Pressable key={t.k} onPress={() => Linking.openURL(rotaUrl(address, t.endereco))} hitSlop={6} accessibilityRole="link" accessibilityLabel={`Rota até o trabalho de ${t.nome}`}>
          <Txt w="semibold" size={13.5} color={ACCENT.ape}>{`${t.nome} ↗`}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

export function TrabalhoSheet({ onClose }: { onClose: () => void }) {
  const d = useData();
  const { updateHousehold } = useActions();
  const toast = useToast();
  const [a, setA] = useState(d.household?.work_a || '');
  const [b, setB] = useState(d.household?.work_b || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateHousehold({ work_a: a.trim(), work_b: b.trim() });
      onClose();
      toast('Endereços salvos', 'mapPin');
    } catch (e: any) { setErr(e?.message || 'Não foi possível salvar.'); } finally { setBusy(false); }
  }

  return (
    <AccentCtx.Provider value={ACCENT.ape}>
      <Sheet visible onClose={onClose} title="Trabalho de cada um" footer={<>
        <Spacer />
        <Btn label="Cancelar" kind="ghost" onPress={onClose} />
        <Btn label="Salvar" onPress={save} busy={busy} />
      </>}>
        <Field label={`Trabalho de ${d.nm('a')}`} value={a} onChangeText={setA} placeholder="Endereço ou nome do lugar" maxLength={200} autoFocus />
        <Field label={`Trabalho de ${d.nm('b')}`} value={b} onChangeText={setB} placeholder="Endereço ou nome do lugar" maxLength={200} />
        <Hint>Cada apê com endereço ganha um atalho para a rota no Google Maps, de transporte público, até o trabalho de cada um.</Hint>
        <ErrText msg={err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
