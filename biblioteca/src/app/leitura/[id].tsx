import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Celebration } from '@/components/reading/celebration';
import { ProgressSheet } from '@/components/reading/progress-sheet';
import { RatingStars } from '@/components/reading/rating-stars';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DateField } from '@/components/ui/date-field';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { Body, Label, Muted, Subheading, serif } from '@/components/ui/typography';
import { usePalette } from '@/hooks/use-palette';
import { deleteProgress, deleteReading, finishReading, updateReading } from '@/lib/books';
import { confirm } from '@/lib/confirm';
import { formatDate, todayISO } from '@/lib/dates';
import { FORMAT_LABELS, ORIGIN_LABELS, READING_STATUS_LABELS } from '@/lib/labels';
import { describe, fractionOf, latest } from '@/lib/progress';
import { useInvalidateLibrary, useMyReadings, useReading, type ReadingDetail } from '@/lib/queries';
import { useCurrentLibrary } from '@/providers/library-provider';
import type { ReadingStatus } from '@/types/models';

const REVIEW_MAX = 500;

const STATUS_OPTIONS: { value: ReadingStatus; label: string }[] = (
  ['want', 'reading', 'read', 'abandoned'] as const
).map((value) => ({ value, label: READING_STATUS_LABELS[value] }));

export default function ReadingScreen() {
  const { id, concluir } = useLocalSearchParams<{ id: string; concluir?: string }>();
  const palette = usePalette();
  const reading = useReading(id);

  if (reading.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }
  if (!reading.data) {
    return (
      <Screen edges={[]}>
        <Body>Esta leitura não existe mais.</Body>
        <Button title="Voltar" onPress={() => router.back()} />
      </Screen>
    );
  }
  return (
    <>
      <Stack.Screen options={{ title: 'Leitura' }} />
      <ReadingEditor
        key={reading.data.id}
        reading={reading.data}
        startFinishing={concluir === '1'}
      />
    </>
  );
}

function ReadingEditor({
  reading,
  startFinishing,
}: {
  reading: ReadingDetail;
  startFinishing: boolean;
}) {
  const current = useCurrentLibrary();
  const invalidate = useInvalidateLibrary();
  const myReadings = useMyReadings();
  const mine = reading.member_id === current.id;
  const today = todayISO();

  const [finishing, setFinishing] = useState<'read' | 'abandoned' | null>(
    startFinishing && mine && reading.status !== 'read' ? 'read' : null,
  );
  const [finishedAt, setFinishedAt] = useState<string | null>(reading.finished_at ?? today);
  const [rating, setRating] = useState<number | null>(reading.rating);
  const [review, setReview] = useState(reading.review ?? '');
  const [progressOpen, setProgressOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const progress = [...reading.reading_progress].sort((a, b) => b.date.localeCompare(a.date));
  const last = latest(progress);
  const where =
    reading.origin === 'own'
      ? reading.copy
        ? [FORMAT_LABELS[reading.copy.format], reading.copy.platform ?? reading.copy.location]
            .filter(Boolean)
            .join(' · ')
        : 'Meu exemplar'
      : [ORIGIN_LABELS[reading.origin], reading.lent_by ? `de ${reading.lent_by}` : null]
          .filter(Boolean)
          .join(' ');

  async function run(action: () => Promise<void>) {
    setError(null);
    setSaving(true);
    try {
      await action();
      invalidate();
    } catch {
      setError('Não foi possível salvar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }

  function changeStatus(status: ReadingStatus) {
    if (status === reading.status && !finishing) return;
    if (status === 'read' || status === 'abandoned') {
      setFinishing(status);
      return;
    }
    setFinishing(null);
    run(() =>
      updateReading(reading.id, {
        status,
        started_at: status === 'reading' ? (reading.started_at ?? today) : reading.started_at,
        finished_at: null,
      }),
    );
  }

  async function finish() {
    if (!finishing || !finishedAt) return;
    if (reading.started_at && finishedAt < reading.started_at) {
      setError('O término não pode ser antes do início.');
      return;
    }
    const status = finishing;
    await run(async () => {
      await finishReading({
        readingId: reading.id,
        status,
        finishedAt,
        rating: status === 'read' ? rating : null,
        review: status === 'read' ? review.trim() || null : null,
      });
      setFinishing(null);
      if (status === 'read') {
        const year = finishedAt.slice(0, 4);
        const count =
          (myReadings.data ?? []).filter(
            (r) => r.id !== reading.id && r.status === 'read' && r.finished_at?.startsWith(year),
          ).length + 1;
        setCelebrate(`Livro nº ${count} de ${year}`);
      }
    });
  }

  async function saveRatingAndReview(nextRating = rating) {
    await run(() =>
      updateReading(reading.id, { rating: nextRating, review: review.trim() || null }),
    );
  }

  async function remove() {
    const ok = await confirm(
      'Apagar esta leitura?',
      'O progresso registrado também será apagado.',
      'Apagar',
    );
    if (!ok) return;
    await deleteReading(reading.id);
    invalidate();
    router.back();
  }

  const statusValue = finishing ?? reading.status;

  return (
    <Screen edges={[]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Ver livro ${reading.book.title}`}
        onPress={() => router.push(`/livro/${reading.book_id}`)}
        className="flex-row gap-4">
        <BookCover book={reading.book} width={72} />
        <View className="flex-1 justify-center gap-1">
          <Text className="text-xl font-semibold text-ink" style={serif} numberOfLines={3}>
            {reading.book.title}
          </Text>
          <Muted numberOfLines={1}>{reading.book.authors.join(', ')}</Muted>
          <Muted>{where}</Muted>
        </View>
      </Pressable>

      {mine ? (
        <SegmentedControl
          accessibilityLabel="Status"
          options={STATUS_OPTIONS}
          value={statusValue}
          onChange={changeStatus}
        />
      ) : (
        <Card>
          <Body>{READING_STATUS_LABELS[reading.status]}</Body>
          <Muted>Leitura de outra pessoa da família — só ela pode editar.</Muted>
        </Card>
      )}

      {finishing && mine ? (
        <Card className="gap-4">
          <Subheading>{finishing === 'read' ? 'Terminei!' : 'Abandonar leitura'}</Subheading>
          <DateField
            label={finishing === 'read' ? 'Terminei em' : 'Parei em'}
            value={finishedAt}
            min={reading.started_at ?? undefined}
            max={today}
            onChange={setFinishedAt}
          />
          {finishing === 'read' ? (
            <>
              <View className="gap-1">
                <Label>Nota</Label>
                <RatingStars value={rating} onChange={setRating} />
              </View>
              <TextField
                label="Resenha curta (opcional)"
                value={review}
                onChangeText={(t) => setReview(t.slice(0, REVIEW_MAX))}
                multiline
                numberOfLines={4}
                hint={`${review.length}/${REVIEW_MAX}`}
                style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }}
              />
            </>
          ) : (
            <Muted>
              O livro some do “Lendo agora”. Dá para retomar quando quiser registrando progresso.
            </Muted>
          )}
          {error ? <Body className="text-danger">{error}</Body> : null}
          <View className="flex-row gap-3">
            <Button
              title="Cancelar"
              variant="secondary"
              className="flex-1"
              onPress={() => setFinishing(null)}
            />
            <Button
              title={finishing === 'read' ? 'Concluir' : 'Abandonar'}
              variant={finishing === 'read' ? 'primary' : 'danger'}
              className="flex-1"
              loading={saving}
              onPress={finish}
            />
          </View>
        </Card>
      ) : null}

      {reading.status === 'read' && !finishing ? (
        <Card className="gap-3">
          <View className="flex-row items-center justify-between">
            <Label>Minha nota</Label>
            <Muted>Lido em {formatDate(reading.finished_at)}</Muted>
          </View>
          <RatingStars
            value={rating}
            onChange={
              mine
                ? (value) => {
                    setRating(value);
                    saveRatingAndReview(value);
                  }
                : undefined
            }
          />
          {mine ? (
            <TextField
              label="Resenha curta"
              value={review}
              onChangeText={(t) => setReview(t.slice(0, REVIEW_MAX))}
              onBlur={() => review !== (reading.review ?? '') && saveRatingAndReview()}
              multiline
              numberOfLines={4}
              hint={`${review.length}/${REVIEW_MAX} · salva ao sair do campo`}
              style={{ minHeight: 100, textAlignVertical: 'top', paddingTop: 12 }}
            />
          ) : reading.review ? (
            <Body className="italic">“{reading.review}”</Body>
          ) : null}
        </Card>
      ) : null}

      {reading.status !== 'read' || progress.length > 0 ? (
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Subheading>Progresso</Subheading>
            {mine && reading.status !== 'read' ? (
              <Button
                title="Progresso"
                icon="add"
                variant="secondary"
                onPress={() => setProgressOpen(true)}
              />
            ) : null}
          </View>
          <View className="gap-2">
            <ProgressBar
              value={fractionOf(last, reading.book)}
              accessibilityLabel="Progresso da leitura"
            />
            <Muted>{describe(last, reading.book)}</Muted>
          </View>
          {progress.length > 0 ? (
            <Card flush>
              {progress.map((row) => (
                <View
                  key={row.id}
                  className="min-h-[48px] flex-row items-center border-b border-line pl-4 pr-1">
                  <Text className="w-28 text-sm text-muted">{formatDate(row.date)}</Text>
                  <Text className="flex-1 text-base text-ink">{describe(row, reading.book)}</Text>
                  {mine ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Apagar registro de ${formatDate(row.date)}`}
                      onPress={() => run(() => deleteProgress(row.id))}
                      className="h-11 w-11 items-center justify-center">
                      <Icon name="close" size={18} color="muted" />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : null}

      {mine ? (
        <View className="gap-3">
          <Subheading>Datas</Subheading>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <DateField
                label="Início"
                value={reading.started_at}
                max={reading.finished_at ?? today}
                onChange={(started_at) => run(() => updateReading(reading.id, { started_at }))}
              />
            </View>
            {reading.finished_at ? (
              <View className="flex-1">
                <DateField
                  label="Término"
                  value={reading.finished_at}
                  min={reading.started_at ?? undefined}
                  max={today}
                  onChange={(finished_at) =>
                    finished_at && run(() => updateReading(reading.id, { finished_at }))
                  }
                />
              </View>
            ) : null}
          </View>
          {error && !finishing ? <Body className="text-danger">{error}</Body> : null}
        </View>
      ) : null}

      <Button
        title="Ler de novo"
        icon="refresh"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: '/livro/novo',
            params: { bookId: reading.book_id, acao: 'leitura' },
          })
        }
      />
      {mine ? (
        <Button title="Apagar leitura" icon="trash-outline" variant="danger" onPress={remove} />
      ) : null}

      <ProgressSheet
        target={
          progressOpen
            ? {
                id: reading.id,
                title: reading.book.title,
                format: reading.copy?.format ?? null,
                book: reading.book,
                progress: reading.reading_progress,
              }
            : null
        }
        onClose={() => setProgressOpen(false)}
        onSaved={({ reachedEnd }) => {
          setProgressOpen(false);
          invalidate();
          if (reachedEnd) {
            setFinishedAt(today);
            setFinishing('read');
          }
        }}
      />
      <Celebration
        visible={celebrate !== null}
        title="Mais um na conta!"
        subtitle={celebrate ?? ''}
        onClose={() => setCelebrate(null)}
      />
    </Screen>
  );
}
