import { formatIsbn } from '@shared/isbn.ts';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Icon, type IconName } from '@/components/ui/icon';
import { OptionSheet } from '@/components/ui/option-sheet';
import { Screen } from '@/components/ui/screen';
import { Body, Heading, Label, Muted, Subheading } from '@/components/ui/typography';
import { usePalette } from '@/hooks/use-palette';
import { deleteBook, deleteCopy, returnLoan, updateCopy } from '@/lib/books';
import { confirm } from '@/lib/confirm';
import { dueLabel, formatDate, todayISO } from '@/lib/dates';
import {
  FORMAT_LABELS,
  LANGUAGE_LABELS,
  ORIGIN_LABELS,
  READING_STATUS_LABELS,
  STATUS_LABELS,
} from '@/lib/labels';
import { useBook, useGenres, useInvalidateLibrary, type BookDetail } from '@/lib/queries';
import type { CopyFormat, CopyStatus } from '@/types/models';

const FORMAT_ICONS: Record<CopyFormat, IconName> = {
  physical: 'book-outline',
  ebook: 'tablet-portrait-outline',
  audiobook: 'headset-outline',
  subscription: 'cloud-outline',
};

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const palette = usePalette();
  const book = useBook(id);
  const genres = useGenres();
  const invalidate = useInvalidateLibrary();

  if (book.isPending) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color={palette.accent} />
      </View>
    );
  }
  if (!book.data) {
    return (
      <Screen edges={[]}>
        <Body>Este livro não existe mais.</Body>
        <Button title="Voltar para a biblioteca" onPress={() => router.replace('/biblioteca')} />
      </Screen>
    );
  }

  const data = book.data;
  const genreNames = data.book_genres
    .map((bg) => genres.data?.find((g) => g.id === bg.genre_id)?.name)
    .filter(Boolean) as string[];
  const meta = [
    data.publisher,
    data.year,
    data.pages ? `${data.pages} páginas` : null,
    data.language ? (LANGUAGE_LABELS[data.language] ?? data.language) : null,
  ].filter(Boolean);
  const activeCopies = data.copies.filter((c) => c.status === 'active');
  const pastCopies = data.copies.filter((c) => c.status !== 'active');

  async function remove() {
    const ok = await confirm(
      `Apagar “${data.title}”?`,
      'Some da biblioteca junto com exemplares, empréstimos e as leituras de todos da família.',
      'Apagar',
    );
    if (!ok) return;
    await deleteBook(data.id);
    invalidate();
    router.replace('/biblioteca');
  }

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <Screen edges={[]}>
        <View className="flex-row gap-4">
          <BookCover book={data} width={120} />
          <View className="flex-1 gap-1">
            <Heading size="md">{data.title}</Heading>
            {data.subtitle ? <Muted className="text-base">{data.subtitle}</Muted> : null}
            {data.authors.length ? <Body>{data.authors.join(', ')}</Body> : null}
            {meta.length ? <Muted>{meta.join(' · ')}</Muted> : null}
            {data.isbn_13 ? <Muted>ISBN {formatIsbn(data.isbn_13)}</Muted> : null}
          </View>
        </View>

        {genreNames.length ? (
          <View className="flex-row flex-wrap gap-2">
            {genreNames.map((name) => (
              <Chip key={name} label={name} />
            ))}
          </View>
        ) : null}

        <View className="flex-row gap-2">
          <Button
            className="flex-1 px-2"
            title="Editar"
            variant="secondary"
            icon="create-outline"
            onPress={() => router.push(`/livro/${data.id}/editar`)}
          />
          <Button
            className="flex-1 px-2"
            title="Exemplar"
            variant="secondary"
            icon="add"
            onPress={() =>
              router.push({
                pathname: '/livro/novo',
                params: { bookId: data.id, acao: 'exemplar' },
              })
            }
          />
          <Button
            className="flex-1 px-2"
            title="Leitura"
            variant="secondary"
            icon="book-outline"
            onPress={() =>
              router.push({ pathname: '/livro/novo', params: { bookId: data.id, acao: 'leitura' } })
            }
          />
        </View>

        <View className="gap-3">
          <Subheading>Exemplares</Subheading>
          {activeCopies.length === 0 ? (
            <Muted>Nenhum exemplar no acervo. As leituras continuam no histórico.</Muted>
          ) : (
            activeCopies.map((copy) => (
              <CopyCard key={copy.id} copy={copy} onChanged={invalidate} />
            ))
          )}
          {pastCopies.length > 0 ? (
            <View className="gap-2">
              <Label className="px-1">Não estão mais no acervo</Label>
              {pastCopies.map((copy) => (
                <CopyCard key={copy.id} copy={copy} onChanged={invalidate} />
              ))}
            </View>
          ) : null}
        </View>

        <View className="gap-3">
          <Subheading>Leituras</Subheading>
          {data.readings.length === 0 ? (
            <Muted>Ninguém da família registrou leitura deste livro ainda.</Muted>
          ) : (
            <Card flush>
              {[...data.readings]
                .sort((a, b) =>
                  (b.finished_at ?? b.started_at ?? b.created_at).localeCompare(
                    a.finished_at ?? a.started_at ?? a.created_at,
                  ),
                )
                .map((reading) => (
                  <Pressable
                    key={reading.id}
                    accessibilityRole="button"
                    onPress={() => router.push(`/leitura/${reading.id}`)}
                    className="gap-0.5 border-b border-line px-4 py-3 active:bg-sunken">
                    <Text className="text-base text-ink">
                      {reading.member?.display_name ?? 'Alguém'} ·{' '}
                      {READING_STATUS_LABELS[reading.status]}
                      {reading.rating ? ` · ${'★'.repeat(reading.rating)}` : ''}
                    </Text>
                    <Muted>
                      {[
                        reading.origin !== 'own' ? ORIGIN_LABELS[reading.origin] : null,
                        reading.lent_by ? `de ${reading.lent_by}` : null,
                        reading.started_at ? `início ${formatDate(reading.started_at)}` : null,
                        reading.finished_at ? `fim ${formatDate(reading.finished_at)}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Muted>
                    {reading.review ? (
                      <Body className="mt-1 italic">“{reading.review}”</Body>
                    ) : null}
                  </Pressable>
                ))}
            </Card>
          )}
        </View>

        <Button title="Apagar livro" variant="danger" icon="trash-outline" onPress={remove} />
      </Screen>
    </>
  );
}

type CopyWithLoans = BookDetail['copies'][number];

function CopyCard({ copy, onChanged }: { copy: CopyWithLoans; onChanged: () => void }) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const openLoan = copy.loans.find((l) => !l.returned_at) ?? null;
  const pastLoans = copy.loans
    .filter((l) => l.returned_at)
    .sort((a, b) => b.lent_at.localeCompare(a.lent_at));
  const active = copy.status === 'active';

  const details = [
    copy.platform,
    copy.location,
    copy.condition,
    copy.acquired_at ? `comprado em ${formatDate(copy.acquired_at)}` : null,
    copy.price != null ? `R$ ${Number(copy.price).toFixed(2).replace('.', ',')}` : null,
  ].filter(Boolean);

  const leaveOptions: { value: CopyStatus | 'delete'; label: string; hint?: string }[] = [
    ...(copy.format === 'subscription'
      ? [{ value: 'expired' as const, label: STATUS_LABELS.expired }]
      : [
          { value: 'sold' as const, label: STATUS_LABELS.sold },
          { value: 'donated' as const, label: STATUS_LABELS.donated },
          { value: 'lost' as const, label: STATUS_LABELS.lost },
        ]),
    { value: 'delete', label: 'Apagar exemplar', hint: 'Cadastrei por engano' },
  ];

  async function leave(value: string) {
    if (value === 'delete') {
      const ok = await confirm(
        'Apagar exemplar?',
        'O histórico de empréstimos dele também some.',
        'Apagar',
      );
      if (!ok) return;
      await deleteCopy(copy.id);
    } else {
      await updateCopy(copy.id, { status: value as CopyStatus });
    }
    onChanged();
  }

  async function markReturned() {
    if (!openLoan) return;
    await returnLoan(openLoan.id, todayISO());
    onChanged();
  }

  async function restore() {
    await updateCopy(copy.id, { status: 'active' });
    onChanged();
  }

  const due = openLoan ? dueLabel(openLoan.due_at) : null;

  return (
    <Card className={`gap-3 ${active ? '' : 'opacity-70'}`}>
      <View className="flex-row items-center gap-3">
        <Icon name={FORMAT_ICONS[copy.format]} color="accent" />
        <View className="flex-1">
          <Body className="font-semibold">
            {FORMAT_LABELS[copy.format]}
            {!active ? ` · ${STATUS_LABELS[copy.status]}` : ''}
          </Body>
          {details.length ? <Muted>{details.join(' · ')}</Muted> : null}
        </View>
      </View>

      {openLoan && due ? (
        <View className={`rounded-xl px-3 py-2 ${due.late ? 'bg-danger/10' : 'bg-sunken'}`}>
          <Text className={`text-sm ${due.late ? 'font-semibold text-danger' : 'text-ink'}`}>
            Emprestado para {openLoan.borrower_name} desde {formatDate(openLoan.lent_at)} ·{' '}
            {due.text}
          </Text>
        </View>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        {active && copy.format === 'physical' && !openLoan ? (
          <Chip
            label="Emprestar"
            icon="hand-right-outline"
            onPress={() => router.push(`/emprestar/${copy.id}`)}
          />
        ) : null}
        {openLoan ? <Chip label="Devolvido" icon="checkmark" onPress={markReturned} /> : null}
        {active && !openLoan ? (
          <Chip label="Não tenho mais" icon="exit-outline" onPress={() => setSheetOpen(true)} />
        ) : null}
        {!active ? (
          <Chip label="Voltou ao acervo" icon="return-down-back" onPress={restore} />
        ) : null}
      </View>

      {pastLoans.length > 0 ? (
        <View className="gap-1">
          <Label>Já emprestado para</Label>
          {pastLoans.map((loan) => (
            <Muted key={loan.id}>
              {loan.borrower_name} · {formatDate(loan.lent_at)} a {formatDate(loan.returned_at)}
            </Muted>
          ))}
        </View>
      ) : null}

      <OptionSheet
        visible={sheetOpen}
        title="O que aconteceu com ele?"
        options={leaveOptions}
        selected={[]}
        onSelect={leave}
        onClose={() => setSheetOpen(false)}
      />
    </Card>
  );
}
