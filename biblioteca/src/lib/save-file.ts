import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** No nativo: grava no cache e abre a folha de compartilhamento (Arquivos, e-mail, Drive…). */
export async function saveTextFile(name: string, content: string, mimeType: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
}
