import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { Icon } from '@/components/ui/icon';
import { MaxContentWidth } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { logProgress } from '@/lib/books';
import { todayISO } from '@/lib/dates';
import { vibrateSuccess } from '@/lib/feedback';
import {
  defaultUnit,
  describe,
  latest,
  parseProgress,
  reachedEnd,
  UNIT_LABELS,
  type ProgressRow,
  type ProgressUnit,
} from '@/lib/progress';
import type { CopyFormat } from '@/types/models';

export type ProgressTarget = {
  id: string;
  title: string;
  format: CopyFormat | null;
  book: { pages: number | null; audio_minutes: number | null };
  progress: ProgressRow[];
};

type ProgressSheetProps = {
  target: ProgressTarget | null;
  onClose: () => void;
  onSaved: (result: { reachedEnd: boolean }) => void;
};

/** "+ progresso": página, % ou minutos, em dois toques a partir da Início. */
export function ProgressSheet({ target, onClose, onSaved }: ProgressSheetProps) {
  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      {target ? (
        <SheetBody key={target.id} target={target} onClose={onClose} onSaved={onSaved} />
      ) : null}
    </Modal>
  );
}

function SheetBody({
  target,
  onClose,
  onSaved,
}: { target: ProgressTarget } & Omit<ProgressSheetProps, 'target'>) {
  const insets = useSafeAreaInsets();
  const palette = usePalette();
  const last = latest(target.progress);
  const [unit, setUnit] = useState<ProgressUnit>(() => {
    if (last?.page != null) return 'page';
    if (last?.minutes != null) return 'minutes';
    if (last?.percent != null) return 'percent';
    return defaultUnit(target.format, target.book);
  });
  const [text, setText] = useState('');
  const [date, setDate] = useState<string | null>(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const units: ProgressUnit[] = [
    ...(target.book.pages ? (['page'] as const) : []),
    'percent',
    ...(target.format === 'audiobook' || target.book.audio_minutes ? (['minutes'] as const) : []),
  ];

  async function save() {
    const parsed = parseProgress(text, unit, target.book);
    if (!parsed.input) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    try {
      await logProgress({ readingId: target.id, date: date ?? todayISO(), ...parsed.input });
      vibrateSuccess();
      onSaved({ reachedEnd: reachedEnd(parsed.input, target.book) });
    } catch {
      setError('Não foi possível salvar. Tente de novo.');
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1">
      <Pressable accessibilityLabel="Fechar" className="flex-1 bg-black/40" onPress={onClose} />
      <View
        className="w-full gap-4 self-center rounded-t-3xl bg-surface px-5 pt-4"
        style={{ maxWidth: MaxContentWidth, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <Text className="text-lg font-semibold text-ink" numberOfLines={2}>
              {target.title}
            </Text>
            <Text className="text-sm text-muted">{describe(last, target.book)}</Text>
          </View>
          <Pressable
            accessibilityLabel="Fechar"
            onPress={onClose}
            className="h-11 w-11 items-center justify-center">
            <Icon name="close" color="muted" />
          </Pressable>
        </View>

        {units.length > 1 ? (
          <View className="flex-row gap-2">
            {units.map((u) => (
              <Chip
                key={u}
                label={UNIT_LABELS[u].long}
                selected={unit === u}
                onPress={() => {
                  setUnit(u);
                  setError(null);
                }}
              />
            ))}
          </View>
        ) : null}

        <View
          className={`min-h-[56px] flex-row items-center rounded-card border bg-paper px-4 ${
            error ? 'border-danger' : 'border-line'
          }`}>
          <TextInput
            accessibilityLabel={UNIT_LABELS[unit].long}
            placeholder={unit === 'page' && target.book.pages ? `de ${target.book.pages}` : '0'}
            placeholderTextColor={palette.muted}
            value={text}
            onChangeText={(t) => {
              setText(t);
              setError(null);
            }}
            keyboardType="decimal-pad"
            inputMode="decimal"
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
            className="flex-1 py-3 text-2xl font-semibold text-ink"
          />
          <Text className="text-base text-muted">{UNIT_LABELS[unit].short}</Text>
        </View>
        {error ? <Text className="text-sm text-danger">{error}</Text> : null}

        <DateField label="Quando" value={date} max={todayISO()} onChange={setDate} />
        <Button title="Salvar progresso" icon="checkmark" loading={saving} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}
