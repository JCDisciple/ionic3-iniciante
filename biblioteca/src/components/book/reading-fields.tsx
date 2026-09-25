import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { Label } from '@/components/ui/typography';
import type { ReadingChoice, ReadingFormValues } from '@/lib/book-form';
import { todayISO } from '@/lib/dates';
import { ORIGIN_LABELS } from '@/lib/labels';
import type { ReadingOrigin } from '@/types/models';

type ReadingFieldsProps = {
  values: ReadingFormValues;
  onChange: (patch: Partial<ReadingFormValues>) => void;
  /** Sem exemplar: pergunta a origem (emprestado, biblioteca…) e não permite "não registrar". */
  external: boolean;
  /** Esconde "Não registrar" (quando a tela existe só para registrar a leitura). */
  required?: boolean;
};

const EXTERNAL_ORIGINS: ReadingOrigin[] = [
  'borrowed',
  'library',
  'subscription',
  'no_longer_owned',
];

/** "Já li / lendo / quero ler" da pré-visualização. */
export function ReadingFields({
  values,
  onChange,
  external,
  required = false,
}: ReadingFieldsProps) {
  const statusOptions: { value: ReadingChoice; label: string }[] = [
    ...(external || required ? [] : [{ value: 'none' as const, label: 'Não registrar' }]),
    { value: 'want', label: 'Quero ler' },
    { value: 'reading', label: 'Lendo' },
    { value: 'read', label: 'Já li' },
  ];
  const today = todayISO();

  function setStatus(status: ReadingChoice) {
    onChange({
      status,
      startedAt: status === 'reading' ? (values.startedAt ?? today) : values.startedAt,
      finishedAt: status === 'read' ? (values.finishedAt ?? today) : values.finishedAt,
    });
  }

  return (
    <View className="gap-4">
      <SegmentedControl
        accessibilityLabel="Leitura"
        options={statusOptions}
        value={values.status}
        onChange={setStatus}
      />

      {external ? (
        <View className="gap-1.5">
          <Label>De onde vem</Label>
          <View className="flex-row flex-wrap gap-2">
            {EXTERNAL_ORIGINS.map((origin) => (
              <Chip
                key={origin}
                label={ORIGIN_LABELS[origin]}
                selected={values.origin === origin}
                onPress={() => onChange({ origin })}
              />
            ))}
          </View>
          {values.origin === 'borrowed' ? (
            <TextField
              label="Emprestado por"
              placeholder="Nome de quem emprestou"
              value={values.lentBy}
              onChangeText={(lentBy) => onChange({ lentBy })}
            />
          ) : null}
        </View>
      ) : null}

      {values.status === 'reading' ? (
        <DateField
          label="Comecei em"
          value={values.startedAt}
          max={today}
          onChange={(startedAt) => onChange({ startedAt })}
        />
      ) : null}
      {values.status === 'read' ? (
        <View className="flex-row gap-3">
          <View className="flex-1">
            <DateField
              label="Comecei em"
              value={values.startedAt}
              max={values.finishedAt ?? today}
              onChange={(startedAt) => onChange({ startedAt })}
            />
          </View>
          <View className="flex-1">
            <DateField
              label="Terminei em"
              value={values.finishedAt}
              min={values.startedAt ?? undefined}
              max={today}
              onChange={(finishedAt) => onChange({ finishedAt })}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}
