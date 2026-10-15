import type { StyleProp, ViewStyle } from 'react-native';

import { maskDay, maskMonth } from '@/lib/format';

import { Field } from './kit';

// Campos com máscara: mês "MM/AAAA" e dia "DD/MM/AAAA" (funcionam igual no Android e no navegador).

export function MonthField({ label, value, onChange, hint, style }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Field label={label} value={value} onChangeText={v => onChange(maskMonth(v))} placeholder="MM/AAAA" keyboardType="number-pad" hint={hint} style={style} maxLength={7} />
  );
}

export function DayField({ label, value, onChange, hint, style }: {
  label: string; value: string; onChange: (v: string) => void; hint?: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Field label={label} value={value} onChangeText={v => onChange(maskDay(v))} placeholder="DD/MM/AAAA" keyboardType="number-pad" hint={hint} style={style} maxLength={10} />
  );
}

export function MoneyField({ label, value, onChange, placeholder = '0,00', hint, style, editable, autoFocus }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string; style?: StyleProp<ViewStyle>;
  editable?: boolean; autoFocus?: boolean;
}) {
  return (
    <Field label={label} value={value} onChangeText={onChange} placeholder={placeholder} keyboardType="decimal-pad" hint={hint} style={style} editable={editable} autoFocus={autoFocus} />
  );
}

export function IntField({ label, value, onChange, style, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; style?: StyleProp<ViewStyle>; placeholder?: string;
}) {
  return (
    <Field label={label} value={value} onChangeText={v => onChange(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" style={style} placeholder={placeholder} />
  );
}
