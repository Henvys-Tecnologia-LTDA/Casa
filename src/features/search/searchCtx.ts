import { createContext, useContext } from 'react';

// Abre a busca geral de qualquer tela (botão de lupa no topo, ou Ctrl/Cmd+K no navegador).

export interface SearchApi { open: () => void }

export const SearchCtx = createContext<SearchApi>({ open: () => {} });
export const useSearch = () => useContext(SearchCtx);
