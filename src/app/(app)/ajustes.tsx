import { useData } from '@/data/DataProvider';
import { SettingsScreen } from '@/features/settings/SettingsScreen';
import { Loading, Screen } from '@/ui/Screen';

export default function Ajustes() {
  const d = useData();
  if (!d.household) return <Screen tab="casa" inTabs={false}><Loading /></Screen>;
  return <SettingsScreen key={d.household.id} />;
}
