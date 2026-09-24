import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import { serif } from '@/components/ui/typography';
import type { Book } from '@/types/models';

type BookCoverProps = {
  book: Pick<Book, 'title' | 'authors' | 'cover_url'>;
  width: number;
};

/** Capa 2:3. Sem imagem, desenha uma capa tipográfica para manter a grade bonita. */
export function BookCover({ book, width }: BookCoverProps) {
  const height = Math.round(width * 1.5);

  if (book.cover_url) {
    return (
      <Image
        source={{ uri: book.cover_url }}
        style={{ width, height, borderRadius: 8 }}
        contentFit="cover"
        transition={150}
        accessibilityLabel={`Capa de ${book.title}`}
      />
    );
  }

  // Miniaturas não comportam o título: mostra só a inicial.
  if (width < 80) {
    return (
      <View
        className="items-center justify-center rounded-md border border-line bg-sunken"
        style={{ width, height }}
        accessible
        accessibilityLabel={`Capa de ${book.title}`}>
        <Text className="text-2xl font-semibold text-accent" style={serif}>
          {book.title.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="justify-between overflow-hidden rounded-lg border border-line bg-sunken p-2"
      style={{ width, height }}
      accessible
      accessibilityLabel={`Capa de ${book.title}`}>
      <Text className="text-sm font-semibold text-ink" style={serif} numberOfLines={5}>
        {book.title}
      </Text>
      {book.authors[0] ? (
        <Text className="text-[10px] text-muted" numberOfLines={2}>
          {book.authors[0]}
        </Text>
      ) : null}
    </View>
  );
}
