import { useQuery } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { router, Stack } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon, type IconName } from '@/components/ui/icon';
import { OptionSheet } from '@/components/ui/option-sheet';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Body, Label, Muted, Subheading } from '@/components/ui/typography';
import { MaxContentWidth } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { mapCategories } from '@/lib/genres';
import {
  createImport,
  enrichLibrary,
  fetchExistingBooks,
  fileToTable,
  finishImport,
  readFileBytes,
  runImport,
  type ImportResult,
} from '@/lib/import/api';
import type { Table } from '@/lib/import/csv';
import {
  cleanCell,
  detectSource,
  FIELDS,
  guessMapping,
  toRecord,
  type FieldKey,
  type ImportSource,
  type Mapping,
} from '@/lib/import/mapping';
import {
  planImport,
  summarize,
  toRpcRow,
  type PlannedRow,
  type RowAction,
} from '@/lib/import/plan';
import { READING_STATUS_LABELS } from '@/lib/labels';
import { useGenreAliases, useGenres, useInvalidateLibrary } from '@/lib/queries';
import { useAuth } from '@/providers/auth-provider';
import { useCurrentLibrary } from '@/providers/library-provider';

type Step = 'source' | 'columns' | 'preview' | 'running' | 'done';
type LoadedFile = { name: string; bytes: Uint8Array; table: Table };

const SOURCES: { value: ImportSource; title: string; icon: IconName; help: string }[] = [
  {
    value: 'goodreads',
    title: 'Goodreads',
    icon: 'book-outline',
    help: 'No site do Goodreads: My Books → Import and export → Export Library. Envie o arquivo .csv.',
  },
  {
    value: 'skoob',
    title: 'Skoob',
    icon: 'bookmarks-outline',
    help: 'Use a exportação da sua estante do Skoob (CSV ou planilha). Se as colunas vierem diferentes, você ajusta no passo seguinte.',
  },
  {
    value: 'sheet',
    title: 'Planilha própria',
    icon: 'grid-outline',
    help: 'CSV ou XLSX com uma linha por livro. A primeira linha deve ter os nomes das colunas.',
  },
];

const PICKER_TYPES =
  Platform.OS === 'web'
    ? [
        '.csv',
        '.txt',
        '.xlsx',
        'text/csv',
        'text/plain',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ]
    : [
        'text/*',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/octet-stream',
      ];

const ACTION_LABELS: Record<RowAction, string> = {
  copy: 'Exemplar',
  reading: 'Só leitura',
  skip: 'Ignorar',
};

export default function ImportScreen() {
  const current = useCurrentLibrary();
  const { user } = useAuth();
  const invalidate = useInvalidateLibrary();
  const genres = useGenres();
  const aliases = useGenreAliases();

  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<ImportSource>('goodreads');
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [defaultAction, setDefaultAction] = useState<'copy' | 'reading'>('copy');
  const [overrides, setOverrides] = useState<Map<number, RowAction>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{
    phase: 'import' | 'enrich';
    done: number;
    total: number;
    updated?: number;
  }>({
    phase: 'import',
    done: 0,
    total: 0,
  });
  const [result, setResult] = useState<
    (ImportResult & { skipped: number; enriched: number }) | null
  >(null);
  const stopEnrich = useRef(false);

  const existing = useQuery({
    queryKey: ['library', current.library_id, 'import-existing', file?.name],
    enabled: step === 'preview' && !!file,
    queryFn: () => fetchExistingBooks(current.library_id),
  });

  const records = useMemo(
    () => (file && mapping ? file.table.rows.map((row, i) => toRecord(row, mapping, i)) : []),
    [file, mapping],
  );
  const plan = useMemo(() => {
    if (!existing.data) return [];
    return planImport(records, existing.data, defaultAction).map((row) =>
      overrides.has(row.record.index) ? { ...row, action: overrides.get(row.record.index)! } : row,
    );
  }, [records, existing.data, defaultAction, overrides]);

  async function pick(chosen: ImportSource) {
    setSource(chosen);
    setError(null);
    const picked = await DocumentPicker.getDocumentAsync({
      type: PICKER_TYPES,
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setLoading(true);
    try {
      const bytes = await readFileBytes(asset.uri);
      const table = fileToTable(asset.name, bytes);
      if (table.rows.length === 0) {
        setError(
          'Não encontramos linhas no arquivo. A primeira linha deve ter os nomes das colunas.',
        );
        return;
      }
      const detected = detectSource(table.headers);
      if (detected === 'goodreads') setSource('goodreads');
      setFile({ name: asset.name, bytes, table });
      setMapping(guessMapping(table.headers));
      setOverrides(new Map());
      setStep('columns');
    } catch {
      setError('Não foi possível ler o arquivo. Use CSV ou XLSX.');
    } finally {
      setLoading(false);
    }
  }

  async function start() {
    if (!file || !user) return;
    const genreList = genres.data ?? [];
    const aliasList = aliases.data ?? [];
    const toSend = plan
      .filter((row) => row.action !== 'skip')
      .map((row) =>
        toRpcRow(
          row,
          row.existingBookId
            ? []
            : mapCategories(row.record.categories, genreList, aliasList).genreIds,
        ),
      );
    const skipped = plan.length - toSend.length;

    setStep('running');
    setProgress({ phase: 'import', done: 0, total: toSend.length });
    try {
      const importId = await createImport({
        libraryId: current.library_id,
        userId: user.id,
        source,
        fileName: file.name,
        rowsTotal: plan.length,
        bytes: file.bytes,
        options: { defaultAction, mapping },
      });
      const imported = await runImport(importId, toSend, (done, total) =>
        setProgress({ phase: 'import', done, total }),
      );
      await finishImport(importId, skipped, toSend.length > 0 && imported.imported === 0);
      invalidate();

      let enriched = 0;
      const withIsbn = plan.some(
        (r) => r.action !== 'skip' && !r.existingBookId && r.record.isbn13,
      );
      if (withIsbn && imported.imported > 0) {
        stopEnrich.current = false;
        setProgress({ phase: 'enrich', done: 0, total: 0, updated: 0 });
        try {
          const done = await enrichLibrary(
            current.library_id,
            (d, t, updated) => setProgress({ phase: 'enrich', done: d, total: t, updated }),
            () => stopEnrich.current,
          );
          enriched = done.updated;
        } catch {
          // Enriquecer é um bônus: se falhar, os livros já estão salvos.
        }
        invalidate();
      }
      setResult({ ...imported, skipped, enriched });
      setStep('done');
    } catch {
      setError('A importação falhou antes de começar. Verifique a conexão e tente de novo.');
      setStep('preview');
    }
  }

  const title = {
    source: 'Importar livros',
    columns: 'Colunas',
    preview: 'Prévia',
    running: 'Importando',
    done: 'Pronto',
  }[step];

  return (
    <>
      <Stack.Screen options={{ title }} />
      {step === 'source' ? (
        <SourceStep loading={loading} error={error} onPick={pick} />
      ) : step === 'columns' && file && mapping ? (
        <ColumnsStep
          file={file}
          source={source}
          mapping={mapping}
          onChange={setMapping}
          onBack={() => setStep('source')}
          onNext={() => setStep('preview')}
        />
      ) : step === 'preview' ? (
        <PreviewStep
          plan={plan}
          loading={existing.isPending}
          defaultAction={defaultAction}
          error={error}
          onDefaultAction={(a) => {
            setDefaultAction(a);
            setOverrides(new Map());
          }}
          onRowAction={(index, action) => setOverrides((m) => new Map(m).set(index, action))}
          onBack={() => setStep('columns')}
          onStart={start}
        />
      ) : step === 'running' ? (
        <RunningStep progress={progress} onSkipEnrich={() => (stopEnrich.current = true)} />
      ) : result ? (
        <DoneStep result={result} records={records} />
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------------------

function SourceStep({
  loading,
  error,
  onPick,
}: {
  loading: boolean;
  error: string | null;
  onPick: (source: ImportSource) => void;
}) {
  const palette = usePalette();
  return (
    <Screen edges={[]}>
      <Muted className="text-base">
        Traga seu histórico de outros apps. Antes de gravar, você revisa tudo: duplicados são
        detectados pelo ISBN ou por título e autor.
      </Muted>
      {SOURCES.map((s) => (
        <Pressable
          key={s.value}
          accessibilityRole="button"
          disabled={loading}
          onPress={() => onPick(s.value)}>
          <Card className="flex-row items-start gap-3">
            <View className="h-11 w-11 items-center justify-center rounded-full bg-sunken">
              <Icon name={s.icon} color="accent" />
            </View>
            <View className="flex-1 gap-1">
              <Body className="font-semibold">{s.title}</Body>
              <Muted>{s.help}</Muted>
            </View>
            <Icon name="chevron-forward" size={18} color="muted" />
          </Card>
        </Pressable>
      ))}
      {loading ? <ActivityIndicator color={palette.accent} /> : null}
      {error ? <Body className="text-danger">{error}</Body> : null}
    </Screen>
  );
}

function ColumnsStep({
  file,
  source,
  mapping,
  onChange,
  onBack,
  onNext,
}: {
  file: LoadedFile;
  source: ImportSource;
  mapping: Mapping;
  onChange: (m: Mapping) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const sample = (file.table.rows[0] ?? []).map((cell) => cleanCell(cell));
  const recognized = detectSource(file.table.headers) === 'goodreads';

  return (
    <Screen edges={[]}>
      <Card className="flex-row items-center gap-3">
        <Icon name="document-text-outline" color="accent" />
        <View className="flex-1">
          <Body className="font-semibold" numberOfLines={1}>
            {file.name}
          </Body>
          <Muted>
            {file.table.rows.length} {file.table.rows.length === 1 ? 'linha' : 'linhas'} ·{' '}
            {file.table.headers.length} colunas
          </Muted>
        </View>
      </Card>
      <Muted>
        {recognized
          ? 'Reconhecemos o formato do Goodreads e já ligamos as colunas. Confira e siga.'
          : source === 'skoob'
            ? 'Ligamos as colunas pelo nome. Confira, principalmente situação da leitura e nota.'
            : 'Diga qual coluna do arquivo corresponde a cada informação. Só o título é obrigatório.'}
      </Muted>

      <Card flush>
        {FIELDS.map((field) => {
          const col = mapping[field.key];
          return (
            <Pressable
              key={field.key}
              accessibilityRole="button"
              accessibilityLabel={`${field.label}: ${col === null ? 'não importar' : file.table.headers[col]}`}
              onPress={() => setEditing(field.key)}
              className="min-h-[56px] flex-row items-center gap-3 border-b border-line px-4 py-2 active:bg-sunken">
              <View className="flex-1">
                <Text className="text-base text-ink">
                  {field.label}
                  {'required' in field ? ' *' : ''}
                </Text>
                {col !== null && sample[col] ? (
                  <Text className="text-xs text-muted" numberOfLines={1}>
                    ex.: {sample[col]}
                  </Text>
                ) : null}
              </View>
              <Text
                className={`max-w-[45%] text-sm ${col === null ? 'text-muted' : 'font-semibold text-accent'}`}
                numberOfLines={1}>
                {col === null ? 'Não importar' : file.table.headers[col]}
              </Text>
              <Icon name="chevron-down" size={16} color="muted" />
            </Pressable>
          );
        })}
      </Card>

      <View className="flex-row gap-3">
        <Button title="Voltar" variant="secondary" className="flex-1" onPress={onBack} />
        <Button
          title="Ver prévia"
          className="flex-1"
          disabled={mapping.title === null}
          onPress={onNext}
        />
      </View>

      <OptionSheet
        visible={editing !== null}
        title={FIELDS.find((f) => f.key === editing)?.label ?? ''}
        options={file.table.headers.map((h, i) => ({
          value: String(i),
          label: h,
          hint: sample[i] ? `ex.: ${sample[i].slice(0, 60)}` : undefined,
        }))}
        selected={editing && mapping[editing] !== null ? [String(mapping[editing])] : []}
        clearLabel="Não importar"
        onClear={() => editing && onChange({ ...mapping, [editing]: null })}
        onSelect={(v) => editing && onChange({ ...mapping, [editing]: Number(v) })}
        onClose={() => setEditing(null)}
      />
    </Screen>
  );
}

type Filter = 'all' | 'library' | 'problems';

function PreviewStep({
  plan,
  loading,
  defaultAction,
  error,
  onDefaultAction,
  onRowAction,
  onBack,
  onStart,
}: {
  plan: PlannedRow[];
  loading: boolean;
  defaultAction: 'copy' | 'reading';
  error: string | null;
  onDefaultAction: (a: 'copy' | 'reading') => void;
  onRowAction: (index: number, action: RowAction) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const palette = usePalette();
  const [filter, setFilter] = useState<Filter>('all');
  const summary = summarize(plan);
  const visible = plan.filter((row) =>
    filter === 'library'
      ? row.existingBookId || row.duplicateOfIndex !== null
      : filter === 'problems'
        ? row.record.errors.length > 0
        : true,
  );
  const toImport = summary.copies + summary.readings;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center gap-3 bg-paper">
        <ActivityIndicator color={palette.accent} />
        <Muted>Comparando com o seu acervo…</Muted>
      </View>
    );
  }

  return (
    <FlatList
      className="bg-paper"
      data={visible}
      keyExtractor={(row) => String(row.record.index)}
      contentContainerStyle={{
        padding: 16,
        gap: 8,
        maxWidth: MaxContentWidth,
        width: '100%',
        alignSelf: 'center',
      }}
      ListHeaderComponent={
        <View className="gap-4 pb-2">
          <View className="flex-row flex-wrap gap-3">
            <SummaryTile label="Entram no acervo" value={summary.copies} />
            <SummaryTile label="Só leitura" value={summary.readings} />
            <SummaryTile label="Ignorados" value={summary.skipped} />
          </View>
          {summary.inLibrary + summary.duplicatesInFile + summary.invalid > 0 ? (
            <Muted>
              {[
                summary.inLibrary &&
                  `${summary.inLibrary} já no acervo (viram só leitura quando têm situação)`,
                summary.duplicatesInFile && `${summary.duplicatesInFile} repetidos no arquivo`,
                summary.invalid && `${summary.invalid} sem título`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Muted>
          ) : null}
          <View className="gap-2">
            <Label>Livros sem indicação de “tenho”</Label>
            <SegmentedControl
              accessibilityLabel="Ação padrão"
              options={[
                { value: 'copy', label: 'Entram no acervo' },
                { value: 'reading', label: 'Só leitura' },
              ]}
              value={defaultAction}
              onChange={onDefaultAction}
            />
          </View>
          <View className="flex-row flex-wrap gap-2">
            <Chip
              label={`Todas (${plan.length})`}
              selected={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <Chip
              label={`Duplicados (${summary.inLibrary + summary.duplicatesInFile})`}
              selected={filter === 'library'}
              onPress={() => setFilter('library')}
            />
            <Chip
              label={`Com problema (${summary.invalid})`}
              selected={filter === 'problems'}
              onPress={() => setFilter('problems')}
            />
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <PreviewRow row={item} onAction={(a) => onRowAction(item.record.index, a)} />
      )}
      ListFooterComponent={
        <View className="gap-3 pt-3">
          {error ? <Body className="text-danger">{error}</Body> : null}
          <Button
            title={
              toImport
                ? `Importar ${toImport} ${toImport === 1 ? 'livro' : 'livros'}`
                : 'Nada para importar'
            }
            icon="cloud-upload-outline"
            disabled={toImport === 0}
            onPress={onStart}
          />
          <Button title="Ajustar colunas" variant="secondary" onPress={onBack} />
        </View>
      }
    />
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <View className="min-w-[96px] flex-1 rounded-card border border-line bg-surface p-3">
      <Text className="text-2xl font-semibold text-ink">{value}</Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
}

function PreviewRow({ row, onAction }: { row: PlannedRow; onAction: (a: RowAction) => void }) {
  const { record } = row;
  const tags = [
    record.status ? READING_STATUS_LABELS[record.status] : null,
    record.rating ? '★'.repeat(record.rating) : null,
    record.isbn13 ? 'ISBN' : null,
  ].filter(Boolean);
  const problem =
    record.errors[0] ??
    (row.duplicateOfIndex !== null
      ? `Repetido (linha ${row.duplicateOfIndex + 2})`
      : row.existingBookId
        ? 'Já está no acervo'
        : null);
  const choices: RowAction[] = row.existingBookId
    ? ['reading', 'skip']
    : ['copy', 'reading', 'skip'];

  return (
    <View
      className={`gap-2 rounded-card border border-line bg-surface p-3 ${row.action === 'skip' ? 'opacity-60' : ''}`}>
      <View className="gap-0.5">
        <Text className="text-base font-semibold text-ink" numberOfLines={2}>
          {record.title || '(sem título)'}
        </Text>
        {record.authors.length ? (
          <Text className="text-sm text-muted" numberOfLines={1}>
            {record.authors.join(', ')}
          </Text>
        ) : null}
        <Text className="text-xs text-muted">
          Linha {record.index + 2}
          {tags.length ? ` · ${tags.join(' · ')}` : ''}
        </Text>
        {problem ? <Text className="text-xs font-semibold text-accent">{problem}</Text> : null}
      </View>
      {record.errors.length === 0 ? (
        <View className="flex-row flex-wrap gap-2">
          {choices.map((choice) => (
            <Chip
              key={choice}
              label={ACTION_LABELS[choice]}
              selected={row.action === choice}
              onPress={() => onAction(choice)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RunningStep({
  progress,
  onSkipEnrich,
}: {
  progress: { phase: 'import' | 'enrich'; done: number; total: number; updated?: number };
  onSkipEnrich: () => void;
}) {
  const palette = usePalette();
  const fraction = progress.total ? progress.done / progress.total : 0;
  return (
    <Screen edges={[]}>
      <View className="flex-1 justify-center gap-4 py-10">
        <ActivityIndicator color={palette.accent} size="large" />
        <Subheading className="text-center">
          {progress.phase === 'import'
            ? 'Gravando na biblioteca…'
            : 'Buscando capas e páginas pelo ISBN…'}
        </Subheading>
        <ProgressBar value={fraction} height={10} accessibilityLabel="Progresso da importação" />
        <Muted className="text-center">
          {progress.total
            ? `${progress.done} de ${progress.total}${progress.phase === 'enrich' ? ` · ${progress.updated ?? 0} completados` : ''}`
            : 'Preparando…'}
        </Muted>
        {progress.phase === 'enrich' ? (
          <Button title="Pular esta etapa" variant="ghost" onPress={onSkipEnrich} />
        ) : (
          <Muted className="text-center">Pode levar alguns segundos. Não feche o app.</Muted>
        )}
      </View>
    </Screen>
  );
}

function DoneStep({
  result,
  records,
}: {
  result: ImportResult & { skipped: number; enriched: number };
  records: { index: number; title: string }[];
}) {
  const titleOf = (index: number) =>
    records.find((r) => r.index === index)?.title || `linha ${index + 2}`;
  return (
    <Screen edges={[]}>
      <View className="items-center gap-2 pt-6">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-sunken">
          <Icon name="checkmark-done" size={32} color="success" />
        </View>
        <Subheading className="text-center">Importação concluída</Subheading>
      </View>
      <Card className="gap-2">
        <Body>
          {result.imported} {result.imported === 1 ? 'linha gravada' : 'linhas gravadas'}
        </Body>
        {result.enriched ? (
          <Muted>{result.enriched} livros ganharam capa, páginas ou editora pelo ISBN.</Muted>
        ) : null}
        {result.skipped ? (
          <Muted>{result.skipped} ignoradas (duplicadas, sem título ou por escolha).</Muted>
        ) : null}
        {result.failed ? (
          <Body className="text-danger">
            {result.failed} {result.failed === 1 ? 'linha falhou' : 'linhas falharam'}.
          </Body>
        ) : null}
      </Card>
      {result.errors.length > 0 ? (
        <Card className="gap-1">
          <Label>Linhas com erro</Label>
          {result.errors.slice(0, 10).map((e) => (
            <Muted key={`${e.index}-${e.message}`} numberOfLines={2}>
              {titleOf(Number(e.index))}: {e.message}
            </Muted>
          ))}
        </Card>
      ) : null}
      <Button
        title="Ver biblioteca"
        icon="library-outline"
        onPress={() => router.replace('/biblioteca')}
      />
      <Button
        title="Ver relatórios"
        variant="secondary"
        onPress={() => router.replace('/relatorios')}
      />
    </Screen>
  );
}
