import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { BookFields } from '@/components/book/book-fields';
import { GenrePicker } from '@/components/book/genre-picker';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Body } from '@/components/ui/typography';
import { usePalette } from '@/hooks/use-palette';
import { formFromBook, validateBook, type FormErrors } from '@/lib/book-form';
import { updateBook } from '@/lib/books';
import { useBook, useGenres, useInvalidateLibrary, type BookDetail } from '@/lib/queries';
import { useCurrentLibrary } from '@/providers/library-provider';

export default function EditBookScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const book = useBook(id);

  return (
    <>
      <Stack.Screen options={{ title: 'Editar livro' }} />
      {book.isPending ? (
        <View className="flex-1 items-center justify-center bg-paper">
          <ActivityIndicator color={palette.accent} />
        </View>
      ) : book.data ? (
        <EditForm key={book.data.id} book={book.data} />
      ) : (
        <Screen edges={[]}>
          <Body>Livro não encontrado.</Body>
        </Screen>
      )}
    </>
  );
}

function EditForm({ book }: { book: BookDetail }) {
  const current = useCurrentLibrary();
  const genres = useGenres();
  const invalidate = useInvalidateLibrary();
  const [values, setValues] = useState(() => formFromBook(book));
  const [genreIds, setGenreIds] = useState(() => book.book_genres.map((bg) => bg.genre_id));
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const hasAudiobook = book.copies.some((c) => c.format === 'audiobook');

  async function save() {
    const { input, errors: found } = validateBook(values);
    setErrors(found);
    if (!input) return;
    setSaving(true);
    setSaveError(null);
    try {
      const { source: _source, ...changes } = input;
      await updateBook(book.id, changes, genreIds);
      invalidate();
      router.back();
    } catch (error) {
      setSaveError(
        String(error).includes('books_library_isbn13_key')
          ? 'Já existe outro livro com este ISBN na biblioteca.'
          : 'Não foi possível salvar. Tente de novo.',
      );
      setSaving(false);
    }
  }

  return (
    <Screen edges={[]}>
      <BookFields
        libraryId={current.library_id}
        values={values}
        errors={errors}
        onChange={(patch) => setValues((v) => ({ ...v, ...patch }))}
        showAudioMinutes={hasAudiobook || !!values.audioMinutes}
      />
      <GenrePicker
        libraryId={current.library_id}
        genres={genres.data ?? []}
        selected={genreIds}
        onChange={setGenreIds}
      />
      {saveError ? <Body className="text-danger">{saveError}</Body> : null}
      <Button title="Salvar alterações" icon="checkmark" loading={saving} onPress={save} />
    </Screen>
  );
}
