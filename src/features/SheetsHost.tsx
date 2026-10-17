import { useMemo, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { AptSheet } from './ape/AptSheet';
import { TrabalhoSheet } from './ape/Trabalho';
import { NoteSheet } from './caderno/NoteSheet';
import { CompartilharSheet } from './compartilhar/CompartilharSheet';
import { GrocerySheet } from './mercado/GrocerySheet';
import { BillPaySheet, BillSheet } from './money/BillSheets';
import { DepositSheet, GoalSheet } from './money/GoalSheets';
import { SettleSheet } from './money/SettleSheet';
import { TabSheet } from './settings/TabSheet';
import { SheetsCtx, type SheetsApi, type SheetState } from './sheetsCtx';
import { BuySheet } from './shop/BuySheet';
import { ItemDetailSheet } from './shop/ItemDetailSheet';
import { InspirationSheet } from './shop/Inspiracoes';
import { ItemEditorSheet } from './shop/ItemEditorSheet';
import { OrganizeSheet } from './shop/OrganizeSheet';
import { SectionSheet } from './shop/SectionSheet';
import { TaskSheet } from './tasks/TaskSheet';
import { PlanSheet } from './trips/Roteiro';
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
      <View style={{ flex: 1 }}>
      {children}
      {s?.kind === 'detail' ? <ItemDetailSheet key={s.key} id={s.id} onClose={close} /> : null}
      {s?.kind === 'item' ? <ItemEditorSheet key={s.key} item={s.item} secId={s.secId} list={s.list} name={s.name} pre={s.pre} onClose={close} /> : null}
      {s?.kind === 'buy' ? <BuySheet key={s.key} id={s.id} onClose={close} /> : null}
      {s?.kind === 'section' ? <SectionSheet key={s.key} list={s.list} sec={s.sec} name={s.name} onClose={close} /> : null}
      {s?.kind === 'apt' ? <AptSheet key={s.key} apt={s.apt} onClose={close} /> : null}
      {s?.kind === 'task' ? <TaskSheet key={s.key} task={s.task} onClose={close} /> : null}
      {s?.kind === 'trip' ? <TripSheet key={s.key} trip={s.trip} onClose={close} /> : null}
      {s?.kind === 'cost' ? <CostSheet key={s.key} tripId={s.tripId} cost={s.cost} onClose={close} /> : null}
      {s?.kind === 'goal' ? <GoalSheet key={s.key} goal={s.goal} name={s.name} onClose={close} /> : null}
      {s?.kind === 'deposit' ? <DepositSheet key={s.key} goalId={s.goalId} onClose={close} /> : null}
      {s?.kind === 'tab' ? <TabSheet key={s.key} tab={s.tab} onClose={close} /> : null}
      {s?.kind === 'organizar' ? <OrganizeSheet key={s.key} list={s.list} onClose={close} /> : null}
      {s?.kind === 'acerto' ? <SettleSheet key={s.key} payer={s.payer} amount={s.amount} onClose={close} /> : null}
      {s?.kind === 'bill' ? <BillSheet key={s.key} bill={s.bill} name={s.name} onClose={close} /> : null}
      {s?.kind === 'billpay' ? <BillPaySheet key={s.key} billId={s.billId} ym={s.ym} onClose={close} /> : null}
      {s?.kind === 'grocery' ? <GrocerySheet key={s.key} g={s.g} onClose={close} /> : null}
      {s?.kind === 'inspiration' ? <InspirationSheet key={s.key} secId={s.secId} insp={s.insp} onClose={close} /> : null}
      {s?.kind === 'trabalho' ? <TrabalhoSheet key={s.key} onClose={close} /> : null}
      {s?.kind === 'plan' ? <PlanSheet key={s.key} tripId={s.tripId} plan={s.plan} onClose={close} /> : null}
      {s?.kind === 'compartilhado' ? <CompartilharSheet key={s.key} text={s.text} url={s.url} title={s.title} onClose={close} /> : null}
      {s?.kind === 'note' ? <NoteSheet key={s.key} note={s.note} tipo={s.tipo} title={s.title} onClose={close} /> : null}
      </View>
    </SheetsCtx.Provider>
  );
}
