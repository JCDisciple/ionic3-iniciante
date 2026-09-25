import { formatIsbn } from '@shared/isbn.ts';
import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { BookFields } from '@/components/book/book-fields';
import { CopyFields } from '@/components/book/copy-fields';
import { GenrePicker } from '@/components/book/genre-picker';
import { ReadingFields } from '@/components/book/reading-fields';
import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Body, Muted, Subheading } from '@/components/ui/typography';
import { usePalette } from '@/hooks/use-palette';
import { batchStore } from '@/lib/batch-store';
import {
  emptyCopyForm,
  emptyReadingForm,
  formFromData,
  toReadingInput,
  validateBook,
  validateCopy,
  type BookFormValues,
  type FormErrors,
} from '@/lib/book-form';
import { addToLibrary, findBookByIsbn } from '@/lib/books';
import { todayISO } from '@/lib/dates';
import { getDraft } from '@/lib/draft-store';
import { vibrateSuccess } from '@/lib/feedback';
import { mapCategories } from '@/lib/genres';
import { FORMAT_LABELS } from '@/lib/labels';
import { lookupIsbn } from '@/lib/lookup';
import {
  useBook,
  useGenreAliases,
  useGenres,
  useInvalidateLibrary,
  type BookDetail,
} from '@/lib/queries';
import { useCurrentLibrary } from '@/providers/library-provider';

type Params = { isbn?: string; draft?: string; bookId?: string; acao?: string; lote?: string };
type Mode = 'new' | 'copy' | 'reading';

/**
 * Pré-visualização antes de salvar. Entradas:
 * - ?isbn=  (scanner): busca na Edge Function e avisa se já está no acervo;
 * - ?draft= (busca por título): usa o resultado escolhido;
 * - ?bookId=&acao=exemplar|leitura: novo exemplar ou leitura de um livro existente;
 * - sem parâmetros: cadastro manual em branco.
 */
export default function NewBookScreen() {
  const params = useLocalSearchParams<Params>();
  const current = useCurrentLibrary();
  const palette = usePalette();
  const draft = getDraft(params.draft);
  const isbn = params.isbn;
  const [choice, setChoice] = useState<Exclude<Mode, 'new'> | null>(null);

  const existing = useQuery({
    queryKey: ['library', current.library_id, 'isbn-existing', isbn],
    enabled: !!isbn && !params.bookId,
    queryFn: () => findBookByIsbn(current.library_id, isbn!),
  });
  const targetId = params.bookId ?? (choice ? existing.data?.id : undefined);
  const target = useBook(targetId);

  const lookup = useQuery({
    queryKey: ['isbn-lookup', isbn],
    enabled: !!isbn && !draft && !params.bookId && existing.isSuccess && !existing.data,
    staleTime: Infinity,
    retry: false,
    queryFn: () => lookupIsbn(isbn!),
  });
  const genres = useGenres();
  const aliases = useGenreAliases();

  const title = targetId
    ? params.acao === 'leitura' || choice === 'reading'
      ? 'Registrar leitura'
      : 'Novo exemplar'
    : 'Novo livro';
  const loading = (
    <View className="flex-1 items-center justify-center gap-3 bg-paper">
      <ActivityIndicator color={palette.accent} size="large" />
      <Muted>{isbn ? 'Buscando os dados do livro…' : 'Carregando…'}</Muted>
    </View>
  );

  if (genres.isPending || aliases.isPending) return loading;

  // Livro existente (por parâmetro ou escolha do usuário)
  if (targetId) {
    if (target.isPending) return loading;
    if (!target.data) return <Missing />;
    const mode: Mode = params.acao === 'leitura' || choice === 'reading' ? 'reading' : 'copy';
    return (
      <>
        <Stack.Screen options={{ title }} />
        <BookEditor
          key={`${mode}-${target.data.id}`}
          mode={mode}
          existingBook={target.data}
          batchIsbn={params.lote ? isbn : undefined}
        />
      </>
    );
  }

  if (isbn && !params.bookId && existing.isPending) return loading;

  if (existing.data) {
    return (
      <>
        <Stack.Screen options={{ title: 'Já está no acervo' }} />
        <Screen edges={[]}>
          <Card className="items-center gap-3 py-6">
            <Icon name="library" size={32} color="accent" />
            <Body className="text-center font-semibold">
              “{existing.data.title}” já está na biblioteca.
            </Body>
            <Muted className="text-center">
              {existing.data.copies.filter((c) => c.status === 'active').length} exemplar(es) no
              acervo. O que você quer fazer?
            </Muted>
          </Card>
          <View className="gap-3">
            <Button title="Adicionar outro exemplar" icon="add" onPress={() => setChoice('copy')} />
            <Button
              title="Registrar leitura"
              icon="book-outline"
              variant="secondary"
              onPress={() => setChoice('reading')}
            />
            <Button
              title="Ver livro"
              variant="ghost"
              onPress={() => router.replace(`/livro/${existing.data!.id}`)}
            />
          </View>
        </Screen>
      </>
    );
  }

  if (isbn && !draft && lookup.isPending) return loading;

  const data = draft ?? lookup.data?.book ?? null;
  const mapping = mapCategories(data?.categories ?? [], genres.data ?? [], aliases.data ?? []);
  const notFound = !!isbn && !draft && !data;

  return (
    <>
      <Stack.Screen options={{ title }} />
      <BookEditor
        key={isbn ?? params.draft ?? 'manual'}
        mode="new"
        initialValues={formFromData(data, isbn)}
        initialGenreIds={mapping.genreIds}
        initialSuggestions={mapping.suggestions}
        notice={
          notFound
            ? lookup.isError
              ? 'Não foi possível buscar agora. Preencha os dados abaixo.'
              : `Não encontramos o ISBN ${formatIsbn(isbn!)}. Preencha os dados abaixo.`
            : undefined
        }
        batchIsbn={params.lote ? isbn : undefined}
      />
    </>
  );
}

function Missing() {
  return (
    <Screen edges={[]}>
      <Body>Livro não encontrado.</Body>
      <Button title="Voltar" onPress={() => router.back()} />
    </Screen>
  );
}

type BookEditorProps = {
  mode: Mode;
  existingBook?: BookDetail;
  initialValues?: BookFormValues;
  initialGenreIds?: string[];
  initialSuggestions?: string[];
  notice?: string;
  batchIsbn?: string;
};

function BookEditor({
  mode,
  existingBook,
  initialValues,
  initialGenreIds = [],
  initialSuggestions = [],
  notice,
  batchIsbn,
}: BookEditorProps) {
  const current = useCurrentLibrary();
  const genres = useGenres();
  const invalidate = useInvalidateLibrary();

  const [book, setBook] = useState<BookFormValues | undefined>(initialValues);
  const [genreIds, setGenreIds] = useState(initialGenreIds);
  const [suggestions, setSuggestions] = useState(initialSuggestions);
  const activeCopies = (existingBook?.copies ?? []).filter((c) => c.status === 'active');
  // Releitura do próprio acervo: aponta para um exemplar existente.
  const [readingCopyId, setReadingCopyId] = useState<string | null>(activeCopies[0]?.id ?? null);
  const [ownership, setOwnership] = useState<'own' | 'external'>(
    mode === 'reading' && activeCopies.length === 0 ? 'external' : 'own',
  );
  const [copy, setCopy] = useState(emptyCopyForm);
  const [reading, setReading] = useState(() =>
    mode === 'reading'
      ? { ...emptyReadingForm(), status: 'read' as const, finishedAt: todayISO() }
      : emptyReadingForm(),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Cria um exemplar novo (cadastro normal ou "novo exemplar"). */
  const hasCopy = mode !== 'reading' && ownership === 'own';
  /** A leitura é de um exemplar da casa (novo ou existente). */
  const readingIsOwn = mode === 'reading' ? ownership === 'own' && !!readingCopyId : hasCopy;

  function changeOwnership(value: 'own' | 'external') {
    setOwnership(value);
    if (value === 'external') {
      setReading((r) => ({
        ...r,
        status: r.status === 'none' ? 'reading' : r.status,
        origin: r.origin === 'own' ? 'borrowed' : r.origin,
      }));
    }
  }

  async function save() {
    setSaveError(null);
    const bookResult = book ? validateBook(book) : { input: null, errors: {} };
    const copyResult = hasCopy ? validateCopy(copy) : { input: null, errors: {} };
    const allErrors = { ...bookResult.errors, ...copyResult.errors };
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) return;

    setSaving(true);
    try {
      const bookId = await addToLibrary({
        libraryId: current.library_id,
        book: existingBook ? { id: existingBook.id } : bookResult.input!,
        genreIds: existingBook ? [] : genreIds,
        copy: hasCopy ? copyResult.input : null,
        reading: (() => {
          const input = toReadingInput(reading, readingIsOwn);
          return input && mode === 'reading' && readingIsOwn
            ? { ...input, copy_id: readingCopyId }
            : input;
        })(),
      });
      vibrateSuccess();
      invalidate();
      if (batchIsbn) {
        batchStore.update(batchIsbn, { state: 'saved' });
        router.back();
      } else {
        router.replace(`/livro/${bookId}`);
      }
    } catch {
      setSaveError('Não foi possível salvar. Verifique a conexão e tente de novo.');
      setSaving(false);
    }
  }

  return (
    <Screen edges={[]}>
      {notice ? (
        <Card className="flex-row items-center gap-3">
          <Icon name="information-circle-outline" color="accent" />
          <Body className="flex-1">{notice}</Body>
        </Card>
      ) : null}

      {existingBook ? (
        <Card className="flex-row items-center gap-4">
          <BookCover book={existingBook} width={56} />
          <View className="flex-1">
            <Body className="font-semibold" numberOfLines={2}>
              {existingBook.title}
            </Body>
            <Muted numberOfLines={1}>{existingBook.authors.join(', ')}</Muted>
          </View>
        </Card>
      ) : book ? (
        <>
          <BookFields
            libraryId={current.library_id}
            values={book}
            errors={errors}
            onChange={(patch) => setBook((b) => ({ ...b!, ...patch }))}
            showAudioMinutes={hasCopy && copy.format === 'audiobook'}
          />
          <GenrePicker
            libraryId={current.library_id}
            genres={genres.data ?? []}
            selected={genreIds}
            onChange={setGenreIds}
            suggestions={suggestions}
            onSuggestionMapped={(s) => setSuggestions((list) => list.filter((x) => x !== s))}
          />
        </>
      ) : null}

      {mode === 'new' ? (
        <SegmentedControl
          accessibilityLabel="Este livro é seu?"
          options={[
            { value: 'own', label: 'Tenho este livro' },
            { value: 'external', label: 'Só registrar leitura' },
          ]}
          value={ownership}
          onChange={changeOwnership}
        />
      ) : null}

      {hasCopy ? (
        <View className="gap-3">
          <Subheading>Exemplar</Subheading>
          <CopyFields
            values={copy}
            errors={errors}
            onChange={(patch) => setCopy((c) => ({ ...c, ...patch }))}
          />
        </View>
      ) : null}

      {mode === 'reading' && activeCopies.length > 0 ? (
        <View className="gap-2">
          <Subheading>Qual exemplar?</Subheading>
          <View className="flex-row flex-wrap gap-2">
            {activeCopies.map((c) => (
              <Chip
                key={c.id}
                label={[FORMAT_LABELS[c.format], c.platform ?? c.location]
                  .filter(Boolean)
                  .join(' · ')}
                selected={ownership === 'own' && readingCopyId === c.id}
                onPress={() => {
                  setOwnership('own');
                  setReadingCopyId(c.id);
                }}
              />
            ))}
            <Chip
              label="Outra origem"
              selected={ownership === 'external'}
              onPress={() => changeOwnership('external')}
            />
          </View>
        </View>
      ) : null}

      <View className="gap-3">
        <Subheading>Leitura</Subheading>
        {!readingIsOwn ? (
          <Muted>A leitura fica no seu histórico, sem o livro aparecer no acervo.</Muted>
        ) : null}
        <ReadingFields
          values={reading}
          external={!readingIsOwn}
          required={mode === 'reading'}
          onChange={(patch) => setReading((r) => ({ ...r, ...patch }))}
        />
      </View>

      {saveError ? <Body className="text-danger">{saveError}</Body> : null}
      {Object.keys(errors).length > 0 ? (
        <Body className="text-danger">Revise os campos destacados.</Body>
      ) : null}
      <Button
        title={hasCopy ? 'Salvar na estante' : 'Salvar leitura'}
        icon="checkmark"
        loading={saving}
        onPress={save}
      />
    </Screen>
  );
}
