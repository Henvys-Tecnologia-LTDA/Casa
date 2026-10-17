import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';

import { SearchCtx, type SearchApi } from './searchCtx';
import { SearchPanel } from './SearchPanel';

// Dono da busca geral: guarda se ela está aberta e, no navegador, abre com Ctrl/Cmd+K
// de qualquer tela (o mesmo atalho da paleta de comandos do Miro).
export function SearchHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const api = useMemo<SearchApi>(() => ({ open: () => setOpen(true) }), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SearchCtx.Provider value={api}>
      <View style={{ flex: 1 }}>
        {children}
        {open ? <SearchPanel onClose={close} /> : null}
      </View>
    </SearchCtx.Provider>
  );
}
