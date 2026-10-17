import { useActions } from '@/data/DataProvider';
import type { TableName } from '@/lib/types';

import { deletePhotos } from './Photo';
import { useToast } from './Toast';

// Apagar com "Desfazer" no aviso de baixo (como o Gmail). O desfazer recoloca a linha e o que saiu
// junto com ela; as fotos só somem do armazenamento depois que o aviso sumiu sem desfazer.
export function useApagar() {
  const { removeUndo } = useActions();
  const toast = useToast();
  return async (table: TableName, id: string, msg: string, photos: (string | null | undefined)[] = []) => {
    const restore = await removeUndo(table, id);
    let undone = false;
    toast(msg, 'trash', {
      label: 'Desfazer',
      fn: () => {
        undone = true;
        restore()
          .then(() => toast('Voltou!', 'undo'))
          .catch((e: any) => toast(e?.message || 'Não deu para desfazer.', 'x'));
      },
    });
    if (photos.some(Boolean)) setTimeout(() => { if (!undone) deletePhotos(photos); }, 9000);
  };
}
