import * as Haptics from 'expo-haptics';
import { Children, createContext, useContext, type ReactNode } from 'react';
import {
  ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View,
  type KeyboardTypeOptions, type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';

import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';

import { Icon } from './Icon';
import { checkIn, DUR, ease } from './motion';
import { ACCENT, C, F, R, soft } from './theme';

/* ---------- cor de destaque da aba ---------- */

export const AccentCtx = createContext<string>(ACCENT.casa);
export const useAccent = () => useContext(AccentCtx);

export function tap(kind: 'light' | 'success' = 'light') {
  if (Platform.OS === 'web') return;
  try {
    if (kind === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {}
}

/* ---------- texto ---------- */

type Weight = 'light' | 'regular' | 'medium' | 'semibold';
export function Txt({ children, w = 'regular', size = 15, color = C.ink, style, lines, center, upper, track }: {
  children?: ReactNode; w?: Weight; size?: number; color?: string; style?: StyleProp<TextStyle>; lines?: number;
  center?: boolean; upper?: boolean; track?: number;
}) {
  return (
    <Text
      numberOfLines={lines}
      style={[{
        fontFamily: F[w], fontSize: size, color, lineHeight: Math.round(size * 1.4),
        textAlign: center ? 'center' : undefined, textTransform: upper ? 'uppercase' : undefined,
        letterSpacing: track,
      }, style]}>
      {children}
    </Text>
  );
}

export function Serif({ children, size = 28, color = C.ink, style, lines, center }: {
  children?: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle>; lines?: number; center?: boolean;
}) {
  return (
    <Text numberOfLines={lines} style={[{ fontFamily: F.serif, fontSize: size, color, lineHeight: Math.round(size * 1.12), textAlign: center ? 'center' : undefined }, style]}>
      {children}
    </Text>
  );
}

export const Muted = ({ children, size = 14, style, lines }: { children?: ReactNode; size?: number; style?: StyleProp<TextStyle>; lines?: number }) => (
  <Txt size={size} color={C.muted} style={style} lines={lines}>{children}</Txt>
);

export const Label = ({ children, color = C.muted, style }: { children?: ReactNode; color?: string; style?: StyleProp<TextStyle> }) => (
  <Txt w="medium" size={10.5} color={color} upper track={2.1} style={style} lines={1}>{children}</Txt>
);

export const H2 = ({ children, style }: { children?: ReactNode; style?: StyleProp<TextStyle> }) => (
  <Txt w="medium" size={22} style={[{ letterSpacing: -0.3, lineHeight: 27 }, style]}>{children}</Txt>
);

export function ViewHead({ title, sub, style }: { title: string; sub?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ gap: 2 }, style]}>
      <H2>{title}</H2>
      {sub ? (typeof sub === 'string' ? <Muted>{sub}</Muted> : sub) : null}
    </View>
  );
}

/* ---------- botões ---------- */

type BtnKind = 'primary' | 'ghost' | 'ok' | 'danger' | 'dangerSolid';
export function Btn({ label, onPress, kind = 'primary', size = 'md', icon, disabled, busy, style, grow }: {
  label: string; onPress?: () => void; kind?: BtnKind; size?: 'md' | 'sm' | 'xs'; icon?: string; disabled?: boolean;
  busy?: boolean; style?: StyleProp<ViewStyle>; grow?: boolean;
}) {
  const accent = useAccent();
  const pad = size === 'md' ? { paddingVertical: 11, paddingHorizontal: 20 } : size === 'sm' ? { paddingVertical: 8, paddingHorizontal: 15 } : { paddingVertical: 6, paddingHorizontal: 11 };
  const fs = size === 'md' ? 12.5 : size === 'sm' ? 11.5 : 10.5;
  return (
    <Pressable
      onPress={disabled || busy ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => {
        const bg = kind === 'primary' ? (pressed ? accent : C.ink) : kind === 'ok' ? C.ok : kind === 'dangerSolid' ? C.hi
          : kind === 'danger' ? (pressed ? C.hiSoft : 'transparent') : pressed ? C.sunken : 'transparent';
        return [{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: R.pill,
          borderWidth: 1, borderColor: kind === 'ghost' ? (pressed ? C.ink : C.line) : 'transparent', backgroundColor: bg,
          opacity: disabled ? 0.55 : 1, flexGrow: grow ? 1 : 0, transform: [{ scale: pressed ? 0.96 : 1 }], ...pad,
        }, style];
      }}>
      {busy ? <ActivityIndicator size="small" color={kind === 'ghost' || kind === 'danger' ? C.ink : C.bg} /> : null}
      {!busy && icon ? <Icon name={icon} size={size === 'xs' ? 13 : 16} color={btnInk(kind)} /> : null}
      <Text style={{ fontFamily: F.medium, fontSize: fs, letterSpacing: fs * 0.1, textTransform: 'uppercase', color: btnInk(kind) }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
const btnInk = (k: BtnKind) => (k === 'primary' ? C.bg : k === 'ok' || k === 'dangerSolid' ? C.surface : k === 'danger' ? C.hi : C.ink);

export function IconBtn({ icon, onPress, label, size = 36, color = C.ink, style }: {
  icon: string; onPress?: () => void; label: string; size?: number; color?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [{
        width: size, height: size, borderRadius: R.icon, borderWidth: 1, borderColor: pressed ? C.muted : C.line,
        backgroundColor: C.surface, alignItems: 'center', justifyContent: 'center',
      }, style]}>
      <Icon name={icon} size={size > 32 ? 20 : 16} color={color} />
    </Pressable>
  );
}

export function LikeBtn({ on, count, onPress, label }: { on: boolean; count?: number; onPress: () => void; label?: string }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress(); }}
      accessibilityRole="button"
      accessibilityLabel={on ? 'Descurtir' : 'Curtir'}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: on ? C.heart : C.line,
        backgroundColor: C.surface, borderRadius: R.pill, paddingVertical: 5, paddingHorizontal: 10,
      }}>
      <Icon name="heart" size={15} color={on ? C.heart : C.muted} fill={on} />
      {label || count ? <Txt w="semibold" size={13} color={on ? C.heart : C.muted}>{label ?? String(count)}</Txt> : null}
    </Pressable>
  );
}

/* ---------- blocos ---------- */

export function Card({ children, style, onPress, pad = 0 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; pad?: number }) {
  const base: ViewStyle = { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: R.card, padding: pad };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { borderColor: C.ink, transform: [{ scale: 0.985 }] }, style]}>
      {children}
    </Pressable>
  );
}

export function Panel({ title, icon, right, children, style }: { title?: string; icon?: string; right?: ReactNode; children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const accent = useAccent();
  return (
    <Card pad={16} style={[{ gap: 10 }, style]}>
      {title ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
            {icon ? <Icon name={icon} color={accent} /> : null}
            <Txt w="medium" size={17} style={{ flexShrink: 1 }}>{title}</Txt>
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </Card>
  );
}

const PILL_COLORS: Record<string, [string, string]> = {
  alta: [C.hiSoft, C.hi], media: [C.midSoft, C.mid], baixa: [C.loSoft, C.lo], ok: [C.okSoft, C.ok],
  visitar: [C.loSoft, C.lo], visitado: [C.midSoft, C.mid], proposta: [C.okSoft, C.ok], descartado: [C.hiSoft, C.hi],
  sonho: [C.loSoft, C.lo], planejando: [C.midSoft, C.mid], confirmada: [C.okSoft, C.ok],
};
export function Pill({ label, kind = 'baixa', icon }: { label: string; kind?: string; icon?: string }) {
  const accent = useAccent();
  const [bg, fg] = kind === 'acc' || kind === 'feita' ? [soft(accent), accent] : PILL_COLORS[kind] || PILL_COLORS.baixa;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: bg, borderRadius: R.pill, paddingVertical: 3, paddingHorizontal: 9, alignSelf: 'flex-start' }}>
      {icon ? <Icon name={icon} size={12} color={fg} /> : null}
      <Txt w="semibold" size={10.5} color={fg} upper track={0.95} lines={1}>{label}</Txt>
    </View>
  );
}

export function Tag({ label, icon, color = C.ink }: { label: string; icon?: string; color?: string }) {
  const accent = useAccent();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      {icon ? <Icon name={icon} size={13} color={accent} /> : null}
      <Txt w="semibold" size={13} color={color}>{label}</Txt>
    </View>
  );
}

export function Meter({ ratio, cls = 'ok', marker, height = 6, style }: { ratio: number; cls?: 'ok' | 'mid' | 'hi'; marker?: number; height?: number; style?: StyleProp<ViewStyle> }) {
  const pct = Math.max(0, Math.min(100, (Number(ratio) || 0) * 100));
  const color = cls === 'hi' ? C.hi : cls === 'mid' ? C.mid : C.ok;
  return (
    <View style={[{ height, borderRadius: 99, backgroundColor: C.sunken, overflow: 'visible', position: 'relative' }, style]}>
      <View style={{ width: `${pct}%`, height: '100%', borderRadius: 99, backgroundColor: color }} />
      {marker != null ? <View style={{ position: 'absolute', top: -2, bottom: -2, width: 2, left: `${Math.min(100, marker * 100)}%`, backgroundColor: C.ink, opacity: 0.5 }} /> : null}
    </View>
  );
}

export function DuoBar({ a, b }: { a: number; b: number }) {
  const accent = useAccent();
  if (!(a + b > 0)) return null;
  return (
    <View style={{ flexDirection: 'row', height: 8, borderRadius: 99, overflow: 'hidden', gap: 2, backgroundColor: C.sunken }}>
      {a > 0 ? <View style={{ flex: Math.max(0, a), backgroundColor: accent }} /> : null}
      {b > 0 ? <View style={{ flex: Math.max(0, b), backgroundColor: C.heart }} /> : null}
    </View>
  );
}

export function Dot({ kind }: { kind: 'a' | 'b' }) {
  const accent = useAccent();
  return <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: kind === 'a' ? accent : C.heart }} />;
}

export function Note({ kind = 'info', icon = 'info', children }: { kind?: 'info' | 'warn'; icon?: string; children?: ReactNode }) {
  const [bg, fg] = kind === 'warn' ? [C.midSoft, C.mid] : [C.sunken, C.muted];
  return (
    <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderRadius: 10, backgroundColor: bg, alignItems: 'flex-start' }}>
      <View style={{ marginTop: 2 }}><Icon name={icon} size={16} color={fg} /></View>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Txt size={13.5} color={fg}>{children}</Txt> : children}</View>
    </View>
  );
}

export function Empty({ icon, title, text, action }: { icon: string; title: string; text: string; action?: ReactNode }) {
  const accent = useAccent();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 20, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.line, borderRadius: R.card }}>
      <Icon name={icon} size={34} color={accent} />
      <Serif size={26} center>{title}</Serif>
      <Muted style={{ textAlign: 'center', maxWidth: 320 }}>{text}</Muted>
      {action}
    </View>
  );
}

/* ---------- resumo (4 números) e mini cartões ---------- */

export interface StatCell { label: string; value: string; kind?: 'txt' | 'ok' | 'acc'; sub?: ReactNode; extra?: ReactNode }
export function Summary({ cells }: { cells: StatCell[] }) {
  const accent = useAccent();
  return (
    <Card style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {cells.map((c, k) => (
        <View key={c.label + k} style={{
          width: '50%', padding: 14, gap: 3, borderLeftWidth: k % 2 ? 1 : 0, borderTopWidth: k > 1 ? 1 : 0, borderColor: C.line,
        }}>
          <Label>{c.label}</Label>
          {c.kind === 'txt'
            ? <Serif size={22} lines={2}>{c.value}</Serif>
            : <Txt w="medium" size={20} lines={1} color={c.kind === 'ok' ? C.ok : c.kind === 'acc' ? accent : C.ink} style={{ letterSpacing: -0.4 }}>{c.value}</Txt>}
          {c.sub ? (typeof c.sub === 'string' ? <Muted size={12.5}>{c.sub}</Muted> : c.sub) : null}
          {c.extra}
        </View>
      ))}
    </Card>
  );
}

export function Minis({ children }: { children?: ReactNode }) {
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>;
}
export function Mini({ label, value, small, kind, children }: { label: string; value: string; small?: ReactNode; kind?: 'ok' | 'acc' | 'hi' | 'mid'; children?: ReactNode }) {
  const accent = useAccent();
  const color = kind === 'ok' ? C.ok : kind === 'acc' ? accent : kind === 'hi' ? C.hi : kind === 'mid' ? C.mid : C.ink;
  return (
    <View style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: R.card, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, gap: 1, minWidth: '47%', flexGrow: 1, flexBasis: '47%' }}>
      <Label>{label}</Label>
      <Txt w="medium" size={16} color={color}>{value}</Txt>
      {small ? (typeof small === 'string' ? <Muted size={12}>{small}</Muted> : small) : null}
      {children}
    </View>
  );
}

export function Rows({ rows }: { rows: { label: string; value: string; total?: boolean }[] }) {
  const accent = useAccent();
  return (
    <View>
      {rows.map((r, k) => (
        <View key={r.label} style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, paddingVertical: 8,
          borderTopWidth: k ? (r.total ? 1.5 : 1) : 0, borderTopColor: r.total ? C.ink : C.line,
        }}>
          <Txt size={14.5} style={{ flexShrink: 1 }}>{r.label}</Txt>
          <Txt w="medium" size={r.total ? 17 : 15} color={r.total ? accent : C.ink}>{r.value}</Txt>
        </View>
      ))}
    </View>
  );
}

/* ---------- formulário ---------- */

export function Field({ label, value, onChangeText, placeholder, keyboardType, multiline, autoFocus, secure, editable = true, hint, style, onSubmit, autoCapitalize, maxLength }: {
  label?: string; value: string; onChangeText: (v: string) => void; placeholder?: string; keyboardType?: KeyboardTypeOptions;
  multiline?: boolean; autoFocus?: boolean; secure?: boolean; editable?: boolean; hint?: ReactNode; style?: StyleProp<ViewStyle>;
  onSubmit?: () => void; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'; maxLength?: number;
}) {
  const accent = useAccent();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Txt w="semibold" size={12.5} color={C.muted}>{label}</Txt> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A39A90"
        keyboardType={keyboardType}
        multiline={multiline}
        autoFocus={autoFocus}
        secureTextEntry={secure}
        editable={editable}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        onSubmitEditing={onSubmit}
        returnKeyType={onSubmit ? 'done' : undefined}
        selectionColor={accent}
        style={{
          fontFamily: F.regular, fontSize: 15, color: C.ink, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line,
          borderRadius: R.input, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 11 : 8,
          minHeight: multiline ? 70 : 44, textAlignVertical: multiline ? 'top' : 'center', opacity: editable ? 1 : 0.7,
        }}
      />
      {hint ? (typeof hint === 'string' ? <Muted size={12.5}>{hint}</Muted> : hint) : null}
    </View>
  );
}

// Campos lado a lado que quebram para a linha de baixo em telas estreitas.
export function Grid2({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, style]}>
      {Children.toArray(children).filter(Boolean).map((c, k) => (
        <View key={k} style={{ flexGrow: 1, flexBasis: 130, minWidth: 130 }}>{c}</View>
      ))}
    </View>
  );
}

export function Seg<V extends string>({ value, options, onChange, label }: {
  value: V | ''; options: [V, string][]; onChange: (v: V) => void; label?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <Txt w="semibold" size={12.5} color={C.muted}>{label}</Txt> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'flex-start', padding: 3, borderRadius: R.pill, backgroundColor: C.sunken, gap: 2 }}>
        {options.map(([v, t]) => {
          const on = v === value;
          return (
            <Pressable
              key={v}
              onPress={() => { tap(); onChange(v); }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{ paddingVertical: 7, paddingHorizontal: 12, borderRadius: R.pill, backgroundColor: on ? C.surface : 'transparent' }}>
              <Txt w="medium" size={13.5} color={on ? C.ink : C.muted}>{t}</Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Chip({ label, on, onPress, icon, count }: { label: string; on?: boolean; onPress?: () => void; icon?: string; count?: number }) {
  return (
    <Pressable
      onPress={() => { tap(); onPress?.(); }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: R.pill,
        borderWidth: 1, borderColor: on ? C.ink : C.line, backgroundColor: on ? C.ink : 'transparent',
      }}>
      {icon ? <Icon name={icon} size={15} color={on ? C.bg : C.muted} /> : null}
      <Txt w="medium" size={13.5} color={on ? C.bg : C.muted}>{label}</Txt>
      {count != null ? <Txt size={12} color={on ? C.bg : C.muted} style={{ opacity: 0.75 }}>{String(count)}</Txt> : null}
    </Pressable>
  );
}

export function CheckBox({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  const sc = useSharedValue(1);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: sc.get() }] }));
  return (
    <Pressable
      onPress={disabled ? undefined : () => {
        tap(checked ? 'light' : 'success');
        sc.set(withSequence(withTiming(0.86, { duration: 70 }), withTiming(1, ease(DUR.fast))));
        onChange(!checked);
      }}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label}>
      <Animated.View style={[{
        width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: checked ? C.ok : C.line,
        backgroundColor: checked ? C.ok : 'transparent', alignItems: 'center', justifyContent: 'center',
      }, pop]}>
        {checked ? <Animated.View entering={checkIn}><Icon name="check" size={15} color={C.surface} strokeWidth={2.6} /></Animated.View> : null}
      </Animated.View>
    </Pressable>
  );
}

export function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Pressable onPress={() => { tap(); onChange(!value); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'flex-start', paddingVertical: 2 }}>
      <View style={{
        width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: value ? C.ok : C.muted,
        backgroundColor: value ? C.ok : 'transparent', alignItems: 'center', justifyContent: 'center',
      }}>
        {value ? <Icon name="check" size={14} color={C.surface} strokeWidth={2.6} /> : null}
      </View>
      <Txt w="semibold" size={15}>{label}</Txt>
    </Pressable>
  );
}

export const ErrText = ({ msg }: { msg: string }) => (msg ? (
  <View style={{ padding: 12, borderRadius: 10, backgroundColor: C.hiSoft }}>
    <Txt size={14} color={C.hi}>{msg}</Txt>
  </View>
) : null);

export const Hint = ({ children }: { children?: ReactNode }) => <Muted size={12.5}>{children}</Muted>;

export const SecTitle = ({ children }: { children: string }) => {
  return <Txt w="medium" size={11.5} color={C.coral} upper track={2.8} style={{ marginTop: 6 }}>{children}</Txt>;
};

export const styles = StyleSheet.create({
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  hair: { borderTopWidth: 1, borderTopColor: C.line },
});
