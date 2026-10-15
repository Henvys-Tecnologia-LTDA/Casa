import { createContext, useContext } from 'react';

import type { Apartment, Goal, Item, Section, ShopList, TabKey, Task, Trip, TripCost } from '@/lib/types';

// Qual janela de edição está aberta (uma por vez), como os <dialog> da página.

export type SheetState =
  | { kind: 'detail'; id: string }
  | { kind: 'item'; item: Item | null; secId?: string; list?: ShopList }
  | { kind: 'buy'; id: string }
  | { kind: 'section'; list: ShopList; sec: Section | null }
  | { kind: 'apt'; apt: Apartment | null }
  | { kind: 'task'; task: Task | null }
  | { kind: 'trip'; trip: Trip | null }
  | { kind: 'cost'; tripId: string; cost: TripCost | null }
  | { kind: 'goal'; goal: Goal | null }
  | { kind: 'deposit'; goalId: string }
  | { kind: 'tab'; tab: TabKey };

export interface SheetsApi {
  open: (s: SheetState) => void;
  close: () => void;
}

export const SheetsCtx = createContext<SheetsApi>({ open: () => {}, close: () => {} });
export const useSheets = () => useContext(SheetsCtx);
