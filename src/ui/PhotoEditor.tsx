import { Image } from 'expo-image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, BackHandler, Image as RNImage, Keyboard, Platform, StyleSheet, View,
  type GestureResponderEvent, type LayoutChangeEvent,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Rect } from 'react-native-svg';

import { Btn, Chip, ErrText, IconBtn, Muted, Seg, Serif } from './kit';
import { dialogIn, dialogOut } from './motion';
import {
  dragBox, FULL, isPlain, squareIn, toFrac, toPx, turnCrop, turned, turnRot,
  type Box, type Crop, type CropMode, type Grip, type Picked, type PhotoEdit, type Rot,
} from './photoEdit';
import { renderPhoto } from './photoRender';
import { C } from './theme';

// Editor de foto: toda foto escolhida (do casal, de item, apê, viagem, opção) passa por aqui antes
// de ser enviada. Dá para cortar (livre ou quadrado), girar e ver a prévia; Cancelar desiste da
// foto. Fica numa camada por cima de tudo (como a confirmação) e é só JavaScript: o toque é o do
// próprio React Native e o arquivo sai do expo-image-manipulator (celular) ou de um canvas
// (navegador), então funciona igual no APK, no navegador e no iPhone com o site instalado.

export interface EditOpts {
  /** Recorte com que o editor abre. */
  mode?: CropMode;
  /** Mostra o recorte redondo (a foto do casal aparece num círculo). */
  round?: boolean;
  /** Ajuste anterior, para ajustar de novo a mesma foto. */
  initial?: PhotoEdit;
}

interface Job { id: number; img: Picked; opts: EditOpts; done: (r: Picked | null) => void }

let abrir: ((img: Picked, opts: EditOpts) => Promise<Picked | null>) | null = null;
let seq = 0;

/** Abre o editor e espera: devolve a foto ajustada ou null se cancelaram. */
export function editPhoto(img: Picked, opts: EditOpts = {}): Promise<Picked | null> {
  return abrir ? abrir(img, opts) : Promise.resolve(img);
}

export function PhotoEditorProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<Job | null>(null);
  const atual = useRef<Job | null>(null);
  useEffect(() => {
    abrir = (img, opts) => new Promise(resolve => {
      atual.current?.done(null);
      const j: Job = {
        id: ++seq, img, opts,
        done: r => {
          if (atual.current !== j) return;
          atual.current = null;
          setJob(null);
          resolve(r);
        },
      };
      atual.current = j;
      setJob(j);
    });
    return () => { abrir = null; };
  }, []);
  return (
    <View style={{ flex: 1 }}>
      {children}
      {job ? <Editor key={job.id} img={job.img} opts={job.opts} done={job.done} /> : null}
    </View>
  );
}

/* ---------- a tela do editor ---------- */

// O palco da foto é sempre escuro (nos dois temas), para a foto e o recorte aparecerem bem.
const STAGE = '#16110F';
const MASK = 'rgba(12,8,7,0.64)';
const LINE = '#FFFAF8';
const THIRDS = 'rgba(255,250,248,0.45)';
// Alças: OUT px para fora do recorte e IN px para dentro (o miolo fica para arrastar o recorte todo).
const OUT = 26;
const IN = 12;
const PAD = 30;
const MIN = 44;

const baseCrop = (mode: CropMode, t: { w: number; h: number }): Crop => (mode === 'quadrado' ? squareIn(FULL, t.w, t.h) : FULL);

// No navegador: arrastar não rola a página nem seleciona nada; cada alça mostra o cursor certo.
const web = (s: object) => (Platform.OS === 'web' ? s : {}) as object;
const CURSOR: Record<Grip, string> = {
  move: 'move', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
};

function Editor({ img, opts, done }: { img: Picked; opts: EditOpts; done: (r: Picked | null) => void }) {
  const insets = useSafeAreaInsets();
  const [dims, setDims] = useState(img.width > 0 && img.height > 0 ? { w: img.width, h: img.height } : null);
  const [rot, setRot] = useState<Rot>(opts.initial?.rotate ?? 0);
  const [mode, setMode] = useState<CropMode>(opts.initial?.mode ?? opts.mode ?? 'livre');
  // null = o recorte inicial do modo (a foto toda ou o maior quadrado no meio).
  const [crop, setCrop] = useState<Crop | null>(opts.initial?.crop ?? null);
  const [preview, setPreview] = useState(false);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Sem o tamanho vindo da galeria, mede a foto.
  useEffect(() => {
    if (dims) return;
    let alive = true;
    RNImage.getSize(img.uri, (w, h) => { if (alive) setDims({ w, h }); }, () => { if (alive) setErr('Não foi possível abrir esta foto.'); });
    return () => { alive = false; };
  }, [dims, img.uri]);

  // Voltar do Android e Esc no navegador cancelam.
  const cancelar = useRef(() => {});
  useEffect(() => { cancelar.current = () => { if (!busy) done(null); }; });
  useEffect(() => {
    Keyboard.dismiss();
    const sub = BackHandler.addEventListener('hardwareBackPress', () => { cancelar.current(); return true; });
    if (Platform.OS !== 'web') return () => sub.remove();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelar.current(); };
    window.addEventListener('keydown', onKey);
    return () => { sub.remove(); window.removeEventListener('keydown', onKey); };
  }, []);

  // Foto girada encaixada no palco: (bx, by) é o canto, bw×bh o tamanho na tela.
  const t = dims ? turned(dims.w, dims.h, rot) : null;
  const k = t ? Math.max(0, Math.min((stage.w - 2 * PAD) / t.w, (stage.h - 2 * PAD) / t.h)) : 0;
  const bw = t ? t.w * k : 0, bh = t ? t.h * k : 0;
  const bx = (stage.w - bw) / 2, by = (stage.h - bh) / 2;
  const c = crop ?? (t ? baseCrop(mode, t) : FULL);
  const r = toPx(c, bw, bh);
  const square = mode === 'quadrado';
  const round = !!opts.round && square;
  const ready = k > 0;

  // Arrastar (sistema de toque do React Native, como em Organizar): guarda onde o dedo começou e o
  // recorte daquele momento; a cada movimento, recalcula a partir dele.
  const [grab, setGrab] = useState<{ grip: Grip; x: number; y: number; from: Box } | null>(null);
  const dragging = grab != null;
  const soltar = () => setGrab(null);
  const alca = (grip: Grip) => ({
    // Alça sem fundo: sem isto o Android pode achatar a View e o toque cai no palco.
    collapsable: false,
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderTerminationRequest: () => false,
    onResponderGrant: (e: GestureResponderEvent) => setGrab({ grip, x: e.nativeEvent.pageX, y: e.nativeEvent.pageY, from: r }),
    onResponderMove: (e: GestureResponderEvent) => {
      const g = grab;
      if (!g || !ready) return;
      const next = dragBox(g.grip, g.from, e.nativeEvent.pageX - g.x, e.nativeEvent.pageY - g.y, bw, bh, square, Math.min(MIN, bw, bh));
      setCrop(toFrac(next, bw, bh));
    },
    onResponderRelease: soltar,
    onResponderTerminate: soltar,
  });

  const girar = () => { setRot(v => turnRot(v, -1)); setCrop(turnCrop(c, -1)); };
  const trocarModo = (m: CropMode) => {
    setMode(m);
    if (m === 'quadrado' && t) setCrop(squareIn(c, t.w, t.h));
  };
  const original = () => { setRot(0); setCrop(null); };
  const mudou = rot !== 0 || crop != null;

  async function usar() {
    if (!t || !dims || busy) return;
    const edit: PhotoEdit = { rotate: rot, crop: c, mode };
    // Nada mudou: devolve a mesma foto (quem chamou sabe que não precisa enviar de novo).
    if (isPlain(edit)) { done(img); return; }
    // Foto que veio sem tamanho (de um link ou já salva): segue com o tamanho medido aqui.
    const src = img.width > 0 && img.height > 0 ? img : { ...img, width: dims.w, height: dims.h };
    setBusy(true); setErr('');
    try {
      const out = await renderPhoto(src, edit);
      done({ ...out, source: src, edit });
    } catch (e: any) {
      setErr(e?.message || 'Não foi possível preparar a foto.');
      setBusy(false);
    }
  }

  // Posição no palco de um retângulo dado em pixels da foto na tela.
  const at = (x: number, y: number, w: number, h: number) => ({ position: 'absolute' as const, left: bx + x, top: by + y, width: Math.max(0, w), height: Math.max(0, h) });
  const X1 = bx + r.x, Y1 = by + r.y, X2 = X1 + r.w, Y2 = Y1 + r.h;
  const hole = round
    ? `M${X1} ${(Y1 + Y2) / 2}a${r.w / 2} ${r.h / 2} 0 1 0 ${r.w} 0a${r.w / 2} ${r.h / 2} 0 1 0 ${-r.w} 0Z`
    : `M${X1} ${Y1}H${X2}V${Y2}H${X1}Z`;
  const L = Math.min(20, r.w / 2, r.h / 2);
  const marks = `M${X1} ${Y1 + L}V${Y1}H${X1 + L}M${X2 - L} ${Y1}H${X2}V${Y1 + L}M${X2} ${Y2 - L}V${Y2}H${X2 - L}M${X1 + L} ${Y2}H${X1}V${Y2 - L}`;

  // Prévia: só o pedaço cortado, do maior tamanho que cabe no palco.
  const pk = r.w > 0 && r.h > 0 ? Math.max(0, Math.min((stage.w - 2 * PAD) / r.w, (stage.h - 2 * PAD) / r.h)) : 0;
  const pw = r.w * pk, ph = r.h * pk;

  return (
    <Animated.View entering={dialogIn} exiting={dialogOut} style={[StyleSheet.absoluteFill, s.layer, { backgroundColor: C.bg }]}>
      <View style={[s.bar, { paddingTop: insets.top + 10 }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Serif size={26}>Ajustar foto</Serif>
          <Muted size={13}>{preview ? 'Assim a foto vai ficar.' : 'Arraste os cantos ou as bordas para cortar.'}</Muted>
        </View>
        {mudou ? <IconBtn icon="undo" label="Voltar à foto original" onPress={original} /> : null}
        <IconBtn icon="x" label="Cancelar" onPress={() => cancelar.current()} />
      </View>

      <View
        style={[{ flex: 1, backgroundColor: STAGE, overflow: 'hidden' }, web({ touchAction: 'none', userSelect: 'none' })]}
        onLayout={(e: LayoutChangeEvent) => setStage({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {!ready ? (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            {err ? null : <ActivityIndicator color={LINE} />}
          </View>
        ) : preview ? (
          <View style={{ position: 'absolute', left: (stage.w - pw) / 2, top: (stage.h - ph) / 2, width: pw, height: ph, overflow: 'hidden', borderRadius: round ? pw / 2 : 3 }}>
            <View style={{ position: 'absolute', left: -r.x * pk, top: -r.y * pk }}>
              <Turned uri={img.uri} w={bw * pk} h={bh * pk} rot={rot} />
            </View>
          </View>
        ) : (
          <>
            <View style={at(0, 0, bw, bh)} pointerEvents="none">
              <Turned uri={img.uri} w={bw} h={bh} rot={rot} />
            </View>
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <Svg width={stage.w} height={stage.h}>
                <Path d={`M${bx} ${by}h${bw}v${bh}h${-bw}Z${hole}`} fill={MASK} fillRule="evenodd" />
                {dragging ? (
                  <Path
                    d={[1, 2].map(i => `M${X1 + (r.w * i) / 3} ${Y1}V${Y2}M${X1} ${Y1 + (r.h * i) / 3}H${X2}`).join('')}
                    stroke={THIRDS} strokeWidth={1} />
                ) : null}
                <Rect x={X1} y={Y1} width={r.w} height={r.h} fill="none" stroke={LINE} strokeWidth={1.2} />
                <Path d={marks} fill="none" stroke={LINE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </View>
            <View {...alca('move')} style={[at(r.x, r.y, r.w, r.h), web({ cursor: CURSOR.move })]} accessibilityLabel="Mover o recorte" />
            <View {...alca('n')} style={[at(r.x + IN, r.y - OUT, r.w - 2 * IN, OUT + IN), web({ cursor: CURSOR.n })]} />
            <View {...alca('s')} style={[at(r.x + IN, r.y + r.h - IN, r.w - 2 * IN, OUT + IN), web({ cursor: CURSOR.s })]} />
            <View {...alca('w')} style={[at(r.x - OUT, r.y + IN, OUT + IN, r.h - 2 * IN), web({ cursor: CURSOR.w })]} />
            <View {...alca('e')} style={[at(r.x + r.w - IN, r.y + IN, OUT + IN, r.h - 2 * IN), web({ cursor: CURSOR.e })]} />
            <View {...alca('nw')} style={[at(r.x - OUT, r.y - OUT, OUT + IN, OUT + IN), web({ cursor: CURSOR.nw })]} accessibilityLabel="Canto do recorte" />
            <View {...alca('ne')} style={[at(r.x + r.w - IN, r.y - OUT, OUT + IN, OUT + IN), web({ cursor: CURSOR.ne })]} />
            <View {...alca('sw')} style={[at(r.x - OUT, r.y + r.h - IN, OUT + IN, OUT + IN), web({ cursor: CURSOR.sw })]} />
            <View {...alca('se')} style={[at(r.x + r.w - IN, r.y + r.h - IN, OUT + IN, OUT + IN), web({ cursor: CURSOR.se })]} />
          </>
        )}
      </View>

      <View style={[s.bar, s.tools, { paddingBottom: insets.bottom + 14 }]}>
        <View style={s.row}>
          <Seg value={mode} onChange={trocarModo} options={[['livre', 'Livre'], ['quadrado', 'Quadrado']]} />
          <IconBtn icon="rotL" label="Girar 90°" onPress={girar} />
          <Chip label="Prévia" icon="eye" on={preview} onPress={() => setPreview(v => !v)} />
        </View>
        <ErrText msg={err} />
        <View style={s.row}>
          <Btn label="Cancelar" kind="ghost" onPress={() => cancelar.current()} grow />
          <Btn label="Usar foto" icon="check" onPress={usar} busy={busy} disabled={!ready} grow />
        </View>
      </View>
    </Animated.View>
  );
}

// A foto girada ocupando w×h: desenha em pé (ou deitada) e gira pelo centro.
function Turned({ uri, w, h, rot }: { uri: string; w: number; h: number; rot: Rot }) {
  const side = rot % 180 !== 0;
  const iw = side ? h : w, ih = side ? w : h;
  return (
    <View style={{ width: w, height: h }}>
      <Image
        source={{ uri }}
        contentFit="fill"
        style={{ position: 'absolute', width: iw, height: ih, left: (w - iw) / 2, top: (h - ih) / 2, transform: [{ rotate: `${rot}deg` }] }} />
    </View>
  );
}

const s = StyleSheet.create({
  // Acima das janelas (1000) e da confirmação (1100); o aviso curto (1200) continua por cima.
  layer: { zIndex: 1150, elevation: 1150 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 12, width: '100%', maxWidth: 640, alignSelf: 'center' },
  tools: { flexDirection: 'column', alignItems: 'stretch', paddingTop: 12, gap: 12 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
});
