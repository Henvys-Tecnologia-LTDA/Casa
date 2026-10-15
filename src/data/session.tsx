import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { disablePush } from '@/lib/push';
import { supabase } from '@/lib/supabase';

// Sessão do usuário (Supabase Auth) e qual casal está aberto no aparelho.

export interface Membership {
  household_id: string;
  display_name: string;
  name: string;
}

interface SessionCtx {
  session: Session | null;
  loading: boolean;
  memberships: Membership[];
  membershipsLoaded: boolean;
  currentId: string | null;
  setCurrentId: (id: string | null) => void;
  refreshMemberships: () => Promise<Membership[]>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);
const KEY = 'casa.household';

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Lista de casais do usuário, guardada junto com o id de quem ela é.
  const [owned, setOwned] = useState<{ uid: string; list: Membership[] } | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const uid = session?.user.id ?? null;
  const memberships = useMemo(() => (uid && owned?.uid === uid ? owned.list : []), [uid, owned]);
  const membershipsLoaded = !uid || owned?.uid === uid;
  const currentId = uid && current && memberships.some(m => m.household_id === current) ? current : null;

  const refreshMemberships = useCallback(async () => {
    if (!uid) return [];
    const { data, error } = await supabase
      .from('household_members')
      .select('household_id, display_name, joined_at, households(name)')
      .eq('user_id', uid)
      .order('joined_at', { ascending: true });
    let list: Membership[];
    if (error) {
      // Sem conexão: usa a última lista conhecida para o app continuar abrindo.
      const saved = await AsyncStorage.getItem(`${KEY}.list.${uid}`).catch(() => null);
      try { list = saved ? JSON.parse(saved) : []; } catch { list = []; }
    } else {
      list = (data || []).map((r: any) => ({
        household_id: r.household_id,
        display_name: r.display_name || '',
        name: (Array.isArray(r.households) ? r.households[0]?.name : r.households?.name) || 'Casal',
      }));
      AsyncStorage.setItem(`${KEY}.list.${uid}`, JSON.stringify(list)).catch(() => {});
    }
    const stored = await AsyncStorage.getItem(KEY).catch(() => null);
    setCurrent(prev => {
      const want = prev || stored;
      const ok = want && list.some(m => m.household_id === want) ? want : list[0]?.household_id ?? null;
      if (ok) AsyncStorage.setItem(KEY, ok).catch(() => {});
      return ok;
    });
    setOwned({ uid, list });
    return list;
  }, [uid]);

  useEffect(() => {
    // refreshMemberships só muda estado depois do await (resposta do Supabase).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (uid) refreshMemberships();
  }, [uid, refreshMemberships]);

  const setCurrentId = useCallback((id: string | null) => {
    setCurrent(id);
    if (id) AsyncStorage.setItem(KEY, id).catch(() => {});
    else AsyncStorage.removeItem(KEY).catch(() => {});
  }, []);

  const signOut = useCallback(async () => {
    await disablePush().catch(() => {});
    await supabase.auth.signOut().catch(() => {});
    await AsyncStorage.removeItem(KEY).catch(() => {});
    setCurrent(null);
    setOwned(null);
  }, []);

  const value = useMemo(() => ({
    session, loading, memberships, membershipsLoaded, currentId, setCurrentId, refreshMemberships, signOut,
  }), [session, loading, memberships, membershipsLoaded, currentId, setCurrentId, refreshMemberships, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession fora do SessionProvider');
  return c;
}
