import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { dateBR, money } from '@/lib/format';
import { supabase } from '@/lib/supabase';
import { Icon } from '@/ui/Icon';
import { Muted, Txt } from '@/ui/kit';
import { C } from '@/ui/theme';

// O preço que o servidor viu na loja na última conferência diária (alerta "baixou de preço"),
// comparado com o preço anotado no item.
export function PrecoNaLoja({ itemId, anotado }: { itemId: string; anotado: number }) {
  const [visto, setVisto] = useState<{ price: number; checked_at: string } | null>(null);
  useEffect(() => {
    let alive = true;
    supabase.rpc('item_price_check', { p_item: itemId }).then(({ data }) => {
      const r = Array.isArray(data) ? data[0] : null;
      if (alive && r && Number(r.price) > 0) setVisto({ price: Number(r.price), checked_at: String(r.checked_at) });
    });
    return () => { alive = false; };
  }, [itemId]);
  if (!visto) return null;
  const diff = anotado > 0 ? visto.price - anotado : 0;
  const cor = diff < -0.5 ? C.ok : diff > 0.5 ? C.hi : C.muted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, backgroundColor: C.bg }}>
      <Icon name="clock" size={16} color={cor} />
      <View style={{ flex: 1, gap: 1 }}>
        <Txt size={14}>
          Na loja: <Txt w="semibold" size={14} color={cor}>{money(visto.price)}</Txt>
          {diff < -0.5 ? ` (${money(-diff)} abaixo do anotado)` : diff > 0.5 ? ` (${money(diff)} acima do anotado)` : anotado > 0 ? ' (igual ao anotado)' : ''}
        </Txt>
        <Muted size={12}>{`Conferido em ${dateBR(visto.checked_at)}. O app confere todo dia de manhã e avisa se baixar.`}</Muted>
      </View>
    </View>
  );
}
