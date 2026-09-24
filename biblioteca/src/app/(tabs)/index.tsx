import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Body, Heading, Muted, Subheading, serif } from '@/components/ui/typography';
import { pendingInvite } from '@/lib/invites';
import { useMyCurrentReadings, useRecentBooks } from '@/lib/queries';
import { useCurrentLibrary } from '@/providers/library-provider';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function HomeScreen() {
  const current = useCurrentLibrary();
  const readings = useMyCurrentReadings();
  const recent = useRecentBooks();
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  useEffect(() => {
    pendingInvite.get().then(setInviteToken);
  }, []);

  return (
    <Screen>
      <View className="gap-1">
        <Muted>{current.library.name}</Muted>
        <Heading>
          {greeting()}, {current.display_name}
        </Heading>
      </View>

      {inviteToken ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/convite/${inviteToken}`)}>
          <Card className="flex-row items-center gap-3">
            <Icon name="mail-unread-outline" color="accent" />
            <Body className="flex-1">Você tem um convite para outra biblioteca.</Body>
            <Icon name="chevron-forward" size={18} color="muted" />
          </Card>
        </Pressable>
      ) : null}

      <View className="gap-3">
        <Subheading>Lendo agora</Subheading>
        {readings.data && readings.data.length > 0 ? (
          readings.data.map((reading) => (
            <Card key={reading.id} className="flex-row gap-4">
              <BookCover book={reading.book} width={56} />
              <View className="flex-1 justify-center gap-1">
                <Body className="font-semibold" style={serif} numberOfLines={2}>
                  {reading.book.title}
                </Body>
                <Muted numberOfLines={1}>{reading.book.authors.join(', ')}</Muted>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState
            icon="book-outline"
            title="Nenhuma leitura em andamento"
            message="Escaneie um livro da estante para começar seu acervo e registrar o que está lendo."
            action={
              <Button
                title="Escanear livro"
                icon="barcode-outline"
                onPress={() => router.push('/scanner')}
              />
            }
          />
        )}
      </View>

      {recent.data && recent.data.length > 0 ? (
        <View className="gap-3">
          <Subheading>Últimos adicionados</Subheading>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3">
            {recent.data.map((book) => (
              <View key={book.id} className="w-24 gap-1.5">
                <BookCover book={book} width={96} />
                <Text className="text-xs text-ink" numberOfLines={2}>
                  {book.title}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </Screen>
  );
}
