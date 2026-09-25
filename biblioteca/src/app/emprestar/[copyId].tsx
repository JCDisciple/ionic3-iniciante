import { useQuery } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Body, Label, Muted } from '@/components/ui/typography';
import { createLoan } from '@/lib/books';
import { canPickContact, pickContact } from '@/lib/contacts';
import { addDays, todayISO } from '@/lib/dates';
import { vibrateSuccess } from '@/lib/feedback';
import { useInvalidateLibrary } from '@/lib/queries';
import { supabase } from '@/lib/supabase';
import { useCurrentLibrary } from '@/providers/library-provider';
import type { Book, Copy } from '@/types/models';

const DUE_PRESETS = [15, 30, 60];

/** Emprestar um exemplar físico a alguém de fora (RF6). */
export default function LendScreen() {
  const { copyId } = useLocalSearchParams<{ copyId: string }>();
  const current = useCurrentLibrary();
  const invalidate = useInvalidateLibrary();
  const today = todayISO();

  const copy = useQuery({
    queryKey: ['library', current.library_id, 'copy', copyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('copies')
        .select('*, book:books(title, authors, cover_url)')
        .eq('id', copyId)
        .single();
      if (error) throw error;
      return data as Copy & { book: Pick<Book, 'title' | 'authors' | 'cover_url'> };
    },
  });

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [lentAt, setLentAt] = useState<string | null>(today);
  const [dueAt, setDueAt] = useState<string | null>(addDays(today, 30));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function fromContacts() {
    try {
      const contact = await pickContact();
      if (!contact) return;
      setName(contact.name);
      if (contact.phone) setPhone(contact.phone);
    } catch {
      setError('Não foi possível abrir a agenda. Digite o nome.');
    }
  }

  async function save() {
    if (!name.trim()) {
      setError('Para quem você está emprestando?');
      return;
    }
    if (dueAt && lentAt && dueAt < lentAt) {
      setError('A devolução não pode ser antes do empréstimo.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await createLoan({
        libraryId: current.library_id,
        copyId,
        borrowerName: name.trim(),
        borrowerPhone: phone.trim() || null,
        lentAt: lentAt ?? today,
        dueAt,
      });
      vibrateSuccess();
      invalidate();
      router.back();
    } catch (e) {
      setError(
        String(e).includes('loans_open_copy_key')
          ? 'Este exemplar já está emprestado.'
          : 'Não foi possível salvar. Tente de novo.',
      );
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Emprestar' }} />
      <Screen edges={[]}>
        {copy.data ? (
          <Card className="flex-row items-center gap-4">
            <BookCover book={copy.data.book} width={48} />
            <View className="flex-1">
              <Body className="font-semibold" numberOfLines={2}>
                {copy.data.book.title}
              </Body>
              {copy.data.location ? <Muted>{copy.data.location}</Muted> : null}
            </View>
          </Card>
        ) : null}

        <View className="gap-2">
          <TextField
            label="Para quem"
            placeholder="Nome"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            error={error}
          />
          {canPickContact() ? (
            <View className="flex-row">
              <Chip label="Escolher da agenda" icon="person-add-outline" onPress={fromContacts} />
            </View>
          ) : null}
        </View>
        <TextField
          label="WhatsApp (opcional)"
          placeholder="(11) 98765-4321"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          inputMode="tel"
          hint="Para mandar a mensagem de cobrança com um toque."
        />
        <DateField label="Emprestado em" value={lentAt} max={today} onChange={setLentAt} />

        <View className="gap-2">
          <DateField
            label="Devolver até"
            value={dueAt}
            min={lentAt ?? today}
            onChange={setDueAt}
            hint="Você recebe um lembrete nesse dia."
          />
          <Label>Atalhos</Label>
          <View className="flex-row flex-wrap gap-2">
            {DUE_PRESETS.map((days) => {
              const date = addDays(lentAt ?? today, days);
              return (
                <Chip
                  key={days}
                  label={`${days} dias`}
                  selected={dueAt === date}
                  onPress={() => setDueAt(date)}
                />
              );
            })}
            <Chip label="Sem data" selected={dueAt === null} onPress={() => setDueAt(null)} />
          </View>
        </View>

        <Button title="Emprestar" icon="hand-right-outline" loading={saving} onPress={save} />
      </Screen>
    </>
  );
}
