import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { DateField } from '@/components/ui/date-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TextField } from '@/components/ui/text-field';
import { Label } from '@/components/ui/typography';
import type { CopyFormValues, FormErrors } from '@/lib/book-form';
import { todayISO } from '@/lib/dates';
import { CONDITIONS, FORMAT_LABELS, PLATFORMS } from '@/lib/labels';
import type { CopyFormat } from '@/types/models';

type CopyFieldsProps = {
  values: CopyFormValues;
  errors: FormErrors;
  onChange: (patch: Partial<CopyFormValues>) => void;
};

const FORMATS = (Object.keys(FORMAT_LABELS) as CopyFormat[]).map((value) => ({
  value,
  label: FORMAT_LABELS[value],
}));

/** Dados do exemplar: formato e, conforme o caso, plataforma ou localização. */
export function CopyFields({ values, errors, onChange }: CopyFieldsProps) {
  const physical = values.format === 'physical';

  return (
    <View className="gap-4">
      <SegmentedControl
        accessibilityLabel="Formato"
        options={FORMATS}
        value={values.format}
        onChange={(format) => onChange({ format, platform: '' })}
      />

      {physical ? (
        <>
          <TextField
            label="Onde fica"
            placeholder="Ex.: Sala, estante 2"
            value={values.location}
            onChangeText={(location) => onChange({ location })}
          />
          <View className="gap-1.5">
            <Label>Estado</Label>
            <View className="flex-row flex-wrap gap-2">
              {CONDITIONS.map((condition) => (
                <Chip
                  key={condition}
                  label={condition}
                  selected={values.condition === condition}
                  onPress={() =>
                    onChange({ condition: values.condition === condition ? null : condition })
                  }
                />
              ))}
            </View>
          </View>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <DateField
                label="Data da compra"
                value={values.acquiredAt}
                max={todayISO()}
                onChange={(acquiredAt) => onChange({ acquiredAt })}
              />
            </View>
            <View className="flex-1">
              <TextField
                label="Valor (R$)"
                placeholder="0,00"
                value={values.price}
                onChangeText={(price) => onChange({ price })}
                keyboardType="decimal-pad"
                inputMode="decimal"
                error={errors.price}
              />
            </View>
          </View>
        </>
      ) : (
        <View className="gap-1.5">
          <TextField
            label="Plataforma"
            placeholder="Ex.: Kindle"
            value={values.platform}
            onChangeText={(platform) => onChange({ platform })}
          />
          <View className="flex-row flex-wrap gap-2">
            {PLATFORMS[values.format as Exclude<CopyFormat, 'physical'>].map((platform) => (
              <Chip
                key={platform}
                label={platform}
                selected={values.platform === platform}
                onPress={() => onChange({ platform })}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
