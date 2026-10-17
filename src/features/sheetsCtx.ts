import { createContext, useContext } from 'react';

import type {
  Apartment, Bill, Goal, Grocery, Inspiration, Item, Note, NoteKind, Section, ShopList, TabKey, Task, Trip, TripCost, TripPlan,
} from '@/lib/types';

// Qual janela de edição está aberta (uma por vez), como os <dialog> da página.

export type SheetState =
  | { kind: 'detail'; id: string }
  | { kind: 'item'; item: Item | null; secId?: string; list?: ShopList; name?: string; pre?: Partial<Pick<Item, 'name' | 'price' | 'store' | 'link' | 'image'>> }
  | { kind: 'buy'; id: string }
  | { kind: 'section'; list: ShopList; sec: Section | null; name?: string }
  | { kind: 'apt'; apt: Apartment | null }
  | { kind: 'task'; task: Task | null }
  | { kind: 'trip'; trip: Trip | null }
  | { kind: 'cost'; tripId: string; cost: TripCost | null }
  | { kind: 'goal'; goal: Goal | null; name?: string }
  | { kind: 'deposit'; goalId: string }
  | { kind: 'tab'; tab: TabKey }
  | { kind: 'acerto'; payer: 'a' | 'b'; amount: number }
  | { kind: 'organizar'; list: ShopList }
  | { kind: 'note'; note: Note | null; tipo?: NoteKind; title?: string }
  | { kind: 'bill'; bill: Bill | null; name?: string }
  | { kind: 'billpay'; billId: string; ym: string }
  | { kind: 'plan'; tripId: string; plan: TripPlan | null; day?: string | null }
  | { kind: 'inspiration'; secId: string; insp: Inspiration | null }
  | { kind: 'grocery'; g: Grocery }
  | { kind: 'trabalho' }
  | { kind: 'compartilhado'; text: string; url: string; title: string };

export interface SheetsApi {
  open: (s: SheetState) => void;
  close: () => void;
}

export const SheetsCtx = createContext<SheetsApi>({ open: () => {}, close: () => {} });
export const useSheets = () => useContext(SheetsCtx);
