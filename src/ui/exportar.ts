import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

// Entrega um arquivo de texto: no navegador baixa; no celular salva no cache e abre o "Compartilhar"
// (salvar no Drive, mandar no WhatsApp, abrir no Planilhas…).
export async function salvarArquivo(nome: string, conteudo: string, mime = 'text/csv') {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([conteudo], { type: `${mime};charset=utf-8` }));
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }
  const file = new File(Paths.cache, nome);
  file.create({ overwrite: true });
  file.write(conteudo);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este aparelho não deixa compartilhar arquivos.');
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: nome, UTI: 'public.comma-separated-values-text' });
}
