import { router, Stack } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Body, Muted } from '@/components/ui/typography';
import { usePush } from '@/hooks/use-push';
import { returnLoan } from '@/lib/books';
import { dueLabel, formatDate, todayISO } from '@/lib/dates';
import { useInvalidateLibrary, useOpenLoans, type OpenLoan } from '@/lib/queries';
import { reminderText, whatsappUrl } from '@/lib/whatsapp';

/** Livros emprestados, do mais atrasado para o mais folgado. */
export default function LoansScreen() {
  const loans = useOpenLoans();
  const invalidate = useInvalidateLibrary();
  const push = usePush();

  async function markReturned(loan: OpenLoan) {
    await returnLoan(loan.id, todayISO());
    invalidate();
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Emprestados' }} />
      <Screen edges={[]}>
        {push.state === 'disabled' ? (
          <Card className="flex-row items-center gap-3">
            <Icon name="notifications-outline" color="accent" />
            <View className="flex-1">
              <Body className="font-semibold">Receber lembretes</Body>
              <Muted>Avisamos no dia da devolução e toda semana de atraso.</Muted>
            </View>
            <Button title="Ativar" loading={push.busy} onPress={push.toggle} />
          </Card>
        ) : null}

        {loans.data && loans.data.length > 0 ? (
          loans.data.map((loan) => (
            <LoanCard key={loan.id} loan={loan} onReturned={() => markReturned(loan)} />
          ))
        ) : loans.isPending ? null : (
          <EmptyState
            icon="hand-right-outline"
            title="Nenhum livro emprestado"
            message="Para emprestar, abra um livro físico da estante e toque em “Emprestar”."
          />
        )}
      </Screen>
    </>
  );
}

function LoanCard({ loan, onReturned }: { loan: OpenLoan; onReturned: () => void }) {
  const due = dueLabel(loan.due_at);
  const book = loan.copy.book;

  function charge() {
    const text = reminderText({
      borrower: loan.borrower_name,
      title: book.title,
      lentAt: loan.lent_at,
      dueAt: loan.due_at,
    });
    Linking.openURL(whatsappUrl(loan.borrower_phone, text));
  }

  return (
    <Card className={`gap-3 ${due.late ? 'border-danger/50' : ''}`}>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push(`/livro/${book.id}`)}
        className="flex-row gap-3">
        <BookCover book={book} width={52} />
        <View className="flex-1 gap-0.5">
          <Text className="text-base font-semibold text-ink" numberOfLines={2}>
            {book.title}
          </Text>
          <Text className="text-sm text-ink">Com {loan.borrower_name}</Text>
          <Text className={`text-sm ${due.late ? 'font-semibold text-danger' : 'text-muted'}`}>
            Desde {formatDate(loan.lent_at)} · {due.text}
          </Text>
        </View>
      </Pressable>
      <View className="flex-row flex-wrap gap-2">
        <Chip label="Devolvido" icon="checkmark" onPress={onReturned} />
        <Chip label="Cobrar no WhatsApp" icon="logo-whatsapp" onPress={charge} />
      </View>
    </Card>
  );
}
