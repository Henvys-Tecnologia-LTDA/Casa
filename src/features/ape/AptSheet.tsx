import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useActions, useData } from '@/data/DataProvider';
import { simulate, STATUS, type SimInput } from '@/lib/calc';
import { fmtInput, fmtNum, inputToYm, money, normLink, parsePct, parsePrice, pctTxt, ymToInput } from '@/lib/format';
import type { Apartment } from '@/lib/types';
import { IntField, MoneyField, MonthField } from '@/ui/fields';
import { AccentCtx, Btn, Chip, ErrText, Field, Grid2, Hint, SecTitle, Seg, Txt } from '@/ui/kit';
import { deletePhotos } from '@/ui/Photo';
import { PhotoZone, usePhotoDraft } from '@/ui/PhotoZone';
import { Sheet, Spacer, useConfirm } from '@/ui/Sheet';
import { ACCENT, C, soft } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { useApagar } from '@/ui/useApagar';

// Editor do apartamento + simulação ao vivo (aptDlg da página).
export function AptSheet({ apt, onClose }: { apt: Apartment | null; onClose: () => void }) {
  const d = useData();
  const { insert, update, hid } = useActions();
  const apagar = useApagar();
  const toast = useToast();
  const confirm = useConfirm();
  const a = apt;
  const [f, setF] = useState(() => ({
    name: a?.name || '', address: a?.address || '', link: a?.link || '', status: a?.status || 'visitar',
    price: a?.price ? fmtInput(a.price) : '', area: fmtNum(a?.area || ''), rooms: a?.rooms ? String(a.rooms) : '', parking: a?.parking ? String(a.parking) : '',
    entrada: a?.entrada ? fmtInput(a.entrada) : '', fgts: a?.fgts ? fmtInput(a.fgts) : '', inicioMes: ymToInput(a?.inicio_mes || ''),
    entradaTipo: a?.entrada_tipo || 'vista', entradaParcelas: String(a?.entrada_parcelas || 24), inicio: a?.inicio || 'depois',
    taxa: fmtNum(a ? a.taxa : 11.5), prazo: String(a?.prazo || 360), seguro: a?.seguro ? fmtInput(a.seguro) : '', sistema: a?.sistema || 'SAC',
    condo: a?.condo ? fmtInput(a.condo) : '', iptu: a?.iptu ? fmtInput(a.iptu) : '', itbi: fmtNum(a ? a.itbi : 3), cartorio: fmtNum(a ? a.cartorio : 1.5),
    notes: a?.notes || '',
  }));
  const set = <K extends keyof typeof f>(k: K) => (v: (typeof f)[K]) => setF(x => ({ ...x, [k]: v }));
  const photo = usePhotoDraft(a?.image || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const read = () => ({
    name: f.name.trim(), address: f.address.trim(), link: normLink(f.link), status: f.status as Apartment['status'],
    price: parsePrice(f.price) || 0, area: parsePct(f.area) || 0, rooms: parseInt(f.rooms, 10) || 0, parking: parseInt(f.parking, 10) || 0,
    entrada: parsePrice(f.entrada) || 0, fgts: parsePrice(f.fgts) || 0,
    entrada_tipo: f.entradaTipo as Apartment['entrada_tipo'], entrada_parcelas: Math.min(240, Math.max(1, parseInt(f.entradaParcelas, 10) || 1)),
    inicio: f.inicio as Apartment['inicio'],
    taxa: parsePct(f.taxa) || 0, prazo: Math.min(480, Math.max(1, parseInt(f.prazo, 10) || 360)), seguro: parsePrice(f.seguro) || 0,
    sistema: f.sistema as Apartment['sistema'],
    condo: parsePrice(f.condo) || 0, iptu: parsePrice(f.iptu) || 0,
    itbi: parsePct(f.itbi) || 0, cartorio: parsePct(f.cartorio) || 0, notes: f.notes.trim(),
    inicio_mes: inputToYm(f.inicioMes),
  });
  const cur = read();
  const s = simulate(cur as SimInput);

  async function save() {
    const v = read();
    if (!v.name) { setErr('Dê um nome ao apartamento.'); return; }
    if (!v.price) { setErr('Preencha o preço do imóvel.'); return; }
    if (v.entrada + v.fgts > v.price) { setErr('Entrada e FGTS somam mais que o preço do imóvel.'); return; }
    if (f.inicioMes.trim() && !v.inicio_mes) { setErr('Mês do primeiro pagamento inválido. Use MM/AAAA.'); return; }
    setBusy(true); setErr('');
    try {
      const image = await photo.result(hid);
      if (a) {
        await update('apartments', a.id, { ...v, image });
        if (a.image && a.image !== image) deletePhotos([a.image]);
        onClose();
        toast('Simulação salva');
      } else {
        const row = await insert('apartments', { ...v, image, likes: [], favorite: !d.t.apartments.length });
        onClose();
        router.push({ pathname: '/apt/[id]', params: { id: row.id } });
        toast('Apartamento adicionado', 'plus');
      }
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível salvar.');
    } finally { setBusy(false); }
  }

  async function del() {
    if (!a) return;
    const ok = await confirm({ title: `Excluir ${a.name || 'este apartamento'}?`, text: 'A simulação e a foto saem da lista de vocês dois.', yes: 'Excluir apartamento' });
    if (!ok) return;
    try {
      await apagar('apartments', a.id, 'Apartamento excluído', [a.image]);
      onClose();
      if (router.canGoBack()) router.back();
    } catch (e: any) { setErr(e?.message || 'Não foi possível excluir.'); }
  }

  const quick = (pct: number) => {
    const p = parsePrice(f.price) || 0;
    if (!p) { setErr('Preencha o preço do imóvel primeiro.'); return; }
    set('entrada')(fmtInput((p * pct) / 100));
  };

  return (
    <AccentCtx.Provider value={ACCENT.ape}>
      <Sheet
        visible
        onClose={onClose}
        title={a ? 'Editar simulação' : 'Novo apartamento'}
        live={
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: soft(ACCENT.ape) }}>
            {cur.price ? (<>
              <Txt size={13.5}>1ª parcela <Txt w="semibold" size={13.5}>{money(s.firstFin)}</Txt></Txt>
              <Txt size={13.5}>Por mês c/ condomínio <Txt w="semibold" size={13.5}>{money(s.monthlyKeys)}</Txt></Txt>
              <Txt size={13.5}>Na mão <Txt w="semibold" size={13.5}>{money(s.cash)}</Txt></Txt>
              {d.renda ? <Txt size={13.5}>Renda <Txt w="semibold" size={13.5}>{pctTxt((s.firstFin / d.renda) * 100)}</Txt></Txt> : null}
            </>) : <Txt size={13.5}>Preencha o preço para ver a simulação.</Txt>}
          </View>
        }
        footer={<>
          {a ? <Btn label="Excluir" kind="danger" icon="trash" onPress={del} /> : null}
          <Spacer />
          <Btn label="Cancelar" kind="ghost" onPress={onClose} />
          <Btn label={busy ? 'Salvando…' : 'Salvar'} onPress={save} busy={busy} />
        </>}>
        <PhotoZone draft={photo} icon="building" hint="Foto do apê: escolha da galeria ou tire com a câmera." />
        <SecTitle>O imóvel</SecTitle>
        <Field label="Nome" value={f.name} onChangeText={set('name')} placeholder="Ex.: Residencial Jardins, 2 quartos" autoFocus={!a} />
        <Grid2>
          <Field label="Endereço ou bairro" value={f.address} onChangeText={set('address')} />
          <Field label="Link do anúncio" value={f.link} onChangeText={set('link')} placeholder="https://" autoCapitalize="none" keyboardType="url" />
        </Grid2>
        <MoneyField label="Preço do imóvel (R$)" value={f.price} onChange={set('price')} placeholder="Ex.: 450.000" />
        <View style={{ gap: 6 }}>
          <Txt w="semibold" size={12.5} color={C.muted}>Situação</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {STATUS.map(([k, t]) => <Chip key={k} label={t} on={f.status === k} onPress={() => set('status')(k)} />)}
          </View>
        </View>
        <Grid2>
          <Field label="Área (m²)" value={f.area} onChangeText={set('area')} keyboardType="decimal-pad" />
          <IntField label="Quartos" value={f.rooms} onChange={set('rooms')} />
          <IntField label="Vagas" value={f.parking} onChange={set('parking')} />
        </Grid2>

        <SecTitle>Entrada</SecTitle>
        <Grid2>
          <MoneyField label="Valor da entrada (R$)" value={f.entrada} onChange={set('entrada')} />
          <MoneyField label="FGTS usado (R$)" value={f.fgts} onChange={set('fgts')} placeholder="0" />
        </Grid2>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {[10, 20, 30].map(p => <Btn key={p} label={`${p}%`} kind="ghost" size="xs" onPress={() => quick(p)} />)}
          {cur.price ? <Hint>{`= ${pctTxt(((cur.entrada + cur.fgts) / cur.price) * 100)} do valor${cur.entrada_tipo === 'parcelada' ? ` · ${cur.entrada_parcelas}× de ${money(cur.entrada / cur.entrada_parcelas)}` : ''}`}</Hint> : null}
        </View>
        <MonthField label="Mês do primeiro pagamento (para o calendário de parcelas)" value={f.inicioMes} onChange={set('inicioMes')} />
        <Seg label="Como vão pagar a entrada" value={f.entradaTipo} onChange={set('entradaTipo')} options={[['vista', 'À vista'], ['parcelada', 'Parcelada']]} />
        {f.entradaTipo === 'parcelada' ? (
          <>
            <IntField label="Em quantas parcelas" value={f.entradaParcelas} onChange={set('entradaParcelas')} />
            <Seg label="O financiamento começa" value={f.inicio} onChange={set('inicio')} options={[['depois', 'Depois da entrada'], ['junto', 'Junto']]} />
          </>
        ) : null}

        <SecTitle>Financiamento</SecTitle>
        <Grid2>
          <Field label="Juros ao ano (%)" value={f.taxa} onChangeText={set('taxa')} placeholder="Ex.: 11,5" keyboardType="decimal-pad" />
          <IntField label="Prazo (meses)" value={f.prazo} onChange={set('prazo')} />
        </Grid2>
        <MoneyField label="Seguros e taxas por mês (R$)" value={f.seguro} onChange={set('seguro')} placeholder="Ex.: 120" />
        <Seg label="Tabela" value={f.sistema} onChange={set('sistema')} options={[['SAC', 'SAC (parcela diminui)'], ['PRICE', 'Price (parcela fixa)']]} />

        <SecTitle>Custos mensais e de compra</SecTitle>
        <Grid2>
          <MoneyField label="Condomínio por mês (R$)" value={f.condo} onChange={set('condo')} />
          <MoneyField label="IPTU por mês (R$)" value={f.iptu} onChange={set('iptu')} />
        </Grid2>
        <Grid2>
          <Field label="ITBI (% do valor)" value={f.itbi} onChangeText={set('itbi')} placeholder="Ex.: 3" keyboardType="decimal-pad" />
          <Field label="Cartório e registro (% do valor)" value={f.cartorio} onChangeText={set('cartorio')} placeholder="Ex.: 1,5" keyboardType="decimal-pad" />
        </Grid2>
        <Field label="Observações" value={f.notes} onChangeText={set('notes')} placeholder="O que gostaram, o que preocupa…" multiline />
        <ErrText msg={err || photo.err} />
      </Sheet>
    </AccentCtx.Provider>
  );
}
