import { Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Body, Muted } from '@/components/ui/typography';
import { todayISO } from '@/lib/dates';
import { buildCsv, buildJson, exportFileName } from '@/lib/export';
import { fetchExportData } from '@/lib/export-data';
import { saveTextFile } from '@/lib/save-file';
import { useCurrentLibrary } from '@/providers/library-provider';

type Kind = 'csv' | 'json';

const OPTIONS: { kind: Kind; icon: IconName; title: string; description: string }[] = [
  {
    kind: 'csv',
    icon: 'grid-outline',
    title: 'Planilha (CSV)',
    description:
      'Uma linha por leitura, com livro, exemplar, situação, nota e datas. Abre no Excel ou Google Planilhas e pode ser importada de volta.',
  },
  {
    kind: 'json',
    icon: 'code-slash-outline',
    title: 'Backup completo (JSON)',
    description:
      'Tudo da biblioteca: livros, gêneros, exemplares, empréstimos, leituras, progresso e metas da família.',
  },
];

/** Exportação completa em CSV/JSON, a qualquer momento. */
export default function ExportScreen() {
  const current = useCurrentLibrary();
  const [busy, setBusy] = useState<Kind | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportAs(kind: Kind) {
    setBusy(kind);
    setError(null);
    setMessage(null);
    try {
      const data = await fetchExportData({ id: current.library_id, name: current.library.name });
      const name = exportFileName(current.library.name, kind, todayISO());
      await saveTextFile(
        name,
        kind === 'csv' ? buildCsv(data) : buildJson(data),
        kind === 'csv' ? 'text/csv' : 'application/json',
      );
      const n = (count: number, one: string, many: string) =>
        `${count} ${count === 1 ? one : many}`;
      setMessage(
        `${name} · ${n(data.books.length, 'livro', 'livros')}, ${n(data.readings.length, 'leitura', 'leituras')}, ${n(data.copies.length, 'exemplar', 'exemplares')}.`,
      );
    } catch {
      setError('Não foi possível gerar o arquivo. Verifique a conexão e tente de novo.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Exportar dados' }} />
      <Screen edges={[]}>
        <Muted className="text-base">
          Seus dados são seus. Baixe uma cópia quando quiser — para guardar, analisar numa planilha
          ou levar para outro app.
        </Muted>
        {OPTIONS.map((option) => (
          <Card key={option.kind} className="gap-3">
            <View className="flex-row items-start gap-3">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-sunken">
                <Icon name={option.icon} color="accent" />
              </View>
              <View className="flex-1 gap-1">
                <Body className="font-semibold">{option.title}</Body>
                <Muted>{option.description}</Muted>
              </View>
            </View>
            <Button
              title={`Baixar ${option.kind.toUpperCase()}`}
              icon="download-outline"
              variant={option.kind === 'csv' ? 'primary' : 'secondary'}
              loading={busy === option.kind}
              disabled={busy !== null}
              onPress={() => exportAs(option.kind)}
            />
          </Card>
        ))}
        {message ? (
          <Card className="flex-row items-center gap-3">
            <Icon name="checkmark-circle" color="success" />
            <Body className="flex-1">{message}</Body>
          </Card>
        ) : null}
        {error ? <Body className="text-danger">{error}</Body> : null}
      </Screen>
    </>
  );
}
