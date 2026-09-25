import { useState } from 'react';
import { View } from 'react-native';

import { CoverPicker } from '@/components/cover-picker';
import { Chip } from '@/components/ui/chip';
import { OptionSheet } from '@/components/ui/option-sheet';
import { TextField } from '@/components/ui/text-field';
import { Label } from '@/components/ui/typography';
import { parseAuthors, type BookFormValues, type FormErrors } from '@/lib/book-form';
import { LANGUAGE_LABELS } from '@/lib/labels';

type BookFieldsProps = {
  libraryId: string;
  values: BookFormValues;
  errors: FormErrors;
  onChange: (patch: Partial<BookFormValues>) => void;
  showAudioMinutes?: boolean;
};

/** Metadados editáveis do livro (capa, título, autores, editora…). */
export function BookFields({
  libraryId,
  values,
  errors,
  onChange,
  showAudioMinutes,
}: BookFieldsProps) {
  const [languageOpen, setLanguageOpen] = useState(false);

  return (
    <View className="gap-4">
      <CoverPicker
        libraryId={libraryId}
        title={values.title}
        authors={parseAuthors(values.authors)}
        coverUrl={values.coverUrl}
        onChange={(coverUrl) => onChange({ coverUrl })}
      />

      <TextField
        label="Título *"
        value={values.title}
        onChangeText={(title) => onChange({ title })}
        error={errors.title}
        maxLength={500}
      />
      <TextField
        label="Subtítulo"
        value={values.subtitle}
        onChangeText={(subtitle) => onChange({ subtitle })}
        maxLength={500}
      />
      <TextField
        label="Autores"
        value={values.authors}
        onChangeText={(authors) => onChange({ authors })}
        hint="Separe por vírgula."
        autoCapitalize="words"
      />
      <TextField
        label="Editora"
        value={values.publisher}
        onChangeText={(publisher) => onChange({ publisher })}
      />
      <View className="flex-row gap-3">
        <View className="flex-1">
          <TextField
            label="Ano"
            value={values.year}
            onChangeText={(year) => onChange({ year })}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={4}
            error={errors.year}
          />
        </View>
        <View className="flex-1">
          <TextField
            label="Páginas"
            value={values.pages}
            onChangeText={(pages) => onChange({ pages })}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={5}
            error={errors.pages}
          />
        </View>
      </View>
      {showAudioMinutes ? (
        <TextField
          label="Duração do audiobook (minutos)"
          value={values.audioMinutes}
          onChangeText={(audioMinutes) => onChange({ audioMinutes })}
          keyboardType="number-pad"
          inputMode="numeric"
          error={errors.audioMinutes}
        />
      ) : null}
      <TextField
        label="ISBN"
        value={values.isbn}
        onChangeText={(isbn) => onChange({ isbn })}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={17}
        error={errors.isbn}
      />
      <View className="gap-1.5">
        <Label>Idioma</Label>
        <View className="flex-row">
          <Chip
            label={
              values.language
                ? (LANGUAGE_LABELS[values.language] ?? values.language)
                : 'Não informado'
            }
            dropdown
            onPress={() => setLanguageOpen(true)}
          />
        </View>
      </View>

      <OptionSheet
        visible={languageOpen}
        title="Idioma"
        options={Object.entries(LANGUAGE_LABELS).map(([value, label]) => ({ value, label }))}
        selected={values.language ? [values.language] : []}
        onSelect={(language) => onChange({ language })}
        clearLabel="Não informado"
        onClear={() => onChange({ language: null })}
        onClose={() => setLanguageOpen(false)}
      />
    </View>
  );
}
