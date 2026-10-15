import { useMemo, useState, type ReactNode } from 'react';

import { AptSheet } from './ape/AptSheet';
import { DepositSheet, GoalSheet } from './money/GoalSheets';
import { SheetsCtx, type SheetsApi, type SheetState } from './sheetsCtx';
import { BuySheet } from './shop/BuySheet';
import { ItemDetailSheet } from './shop/ItemDetailSheet';
import { ItemEditorSheet } from './shop/ItemEditorSheet';
import { SectionSheet } from './shop/SectionSheet';
import { TaskSheet } from './tasks/TaskSheet';
import { CostSheet, TripSheet } from './trips/TripSheets';

export function SheetsHost({ children }: { children: ReactNode }) {
  const [s, setS] = useState<(SheetState & { key: number }) | null>(null);
  const api = useMemo<SheetsApi>(() => ({
    open: x => setS({ ...x, key: Date.now() }),
    close: () => setS(null),
  }), []);
  const close = api.close;
  return (
    <SheetsCtx.Provider value={api}>
      {children}
      {s?.kind === 'detail' ? <ItemDetailSheet key={s.key} id={s.id} onClose={close} /> : null}
      {s?.kind === 'item' ? <ItemEditorSheet key={s.key} item={s.item} secId={s.secId} list={s.list} onClose={close} /> : null}
      {s?.kind === 'buy' ? <BuySheet key={s.key} id={s.id} onClose={close} /> : null}
      {s?.kind === 'section' ? <SectionSheet key={s.key} list={s.list} sec={s.sec} onClose={close} /> : null}
      {s?.kind === 'apt' ? <AptSheet key={s.key} apt={s.apt} onClose={close} /> : null}
      {s?.kind === 'task' ? <TaskSheet key={s.key} task={s.task} onClose={close} /> : null}
      {s?.kind === 'trip' ? <TripSheet key={s.key} trip={s.trip} onClose={close} /> : null}
      {s?.kind === 'cost' ? <CostSheet key={s.key} tripId={s.tripId} cost={s.cost} onClose={close} /> : null}
      {s?.kind === 'goal' ? <GoalSheet key={s.key} goal={s.goal} onClose={close} /> : null}
      {s?.kind === 'deposit' ? <DepositSheet key={s.key} goalId={s.goalId} onClose={close} /> : null}
    </SheetsCtx.Provider>
  );
}
