import { useState } from 'react';
import { View } from 'react-native';

import { Chip } from '@/components/ui/chip';
import { OptionSheet } from '@/components/ui/option-sheet';
import { Label, Muted } from '@/components/ui/typography';
import { normalizeKey } from '@/lib/genres';
import { supabase } from '@/lib/supabase';
import type { Genre } from '@/types/models';

type GenrePickerProps = {
  libraryId: string;
  genres: Genre[];
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Categorias das APIs que não casaram com nenhum gênero. */
  suggestions?: string[];
  onSuggestionMapped?: (suggestion: string) => void;
};

/**
 * Gêneros do livro (pode ter vários). Sugestões vindas das APIs aparecem
 * tracejadas: ao escolher um gênero para elas, o mapeamento é lembrado.
 */
export function GenrePicker({
  libraryId,
  genres,
  selected,
  onChange,
  suggestions = [],
  onSuggestionMapped,
}: GenrePickerProps) {
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<string | null>(null);
  const byId = new Map(genres.map((g) => [g.id, g]));

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((g) => g !== id) : [...selected, id]);
  }

  async function mapSuggestion(genreId: string) {
    const suggestion = mapping;
    setMapping(null);
    if (!suggestion) return;
    if (!selected.includes(genreId)) onChange([...selected, genreId]);
    onSuggestionMapped?.(suggestion);
    // Aprende o apelido para os próximos livros (ignora conflito se já existir).
    await supabase
      .from('genre_aliases')
      .upsert(
        { library_id: libraryId, alias: normalizeKey(suggestion), genre_id: genreId },
        { onConflict: 'library_id,alias' },
      );
  }

  const options = genres.map((g) => ({ value: g.id, label: g.name }));

  return (
    <View className="gap-2">
      <Label>Gêneros</Label>
      <View className="flex-row flex-wrap gap-2">
        {selected.map((id) =>
          byId.get(id) ? (
            <Chip
              key={id}
              label={byId.get(id)!.name}
              selected
              icon="close"
              onPress={() => toggle(id)}
            />
          ) : null,
        )}
        <Chip
          label={selected.length ? 'Mais' : 'Escolher gênero'}
          icon="add"
          onPress={() => setOpen(true)}
        />
      </View>
      {suggestions.length > 0 ? (
        <View className="gap-1.5">
          <Muted>Sugestões das fontes — toque para associar a um gênero:</Muted>
          <View className="flex-row flex-wrap gap-2">
            {suggestions.map((s) => (
              <Chip key={s} label={s} dashed onPress={() => setMapping(s)} />
            ))}
          </View>
        </View>
      ) : null}

      <OptionSheet
        visible={open}
        title="Gêneros"
        multiple
        options={options}
        selected={selected}
        onSelect={toggle}
        onClose={() => setOpen(false)}
      />
      <OptionSheet
        visible={mapping !== null}
        title={`“${mapping ?? ''}” é…`}
        options={options}
        selected={[]}
        onSelect={mapSuggestion}
        onClose={() => setMapping(null)}
      />
    </View>
  );
}
