import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';

type RatingStarsProps = {
  value: number | null;
  onChange?: (value: number | null) => void;
  size?: number;
};

/** Nota de 1 a 5. Tocar na estrela já marcada limpa a nota. */
export function RatingStars({ value, onChange, size = 30 }: RatingStarsProps) {
  return (
    <View
      className="flex-row"
      accessibilityRole={onChange ? 'adjustable' : 'text'}
      accessibilityLabel={value ? `Nota ${value} de 5` : 'Sem nota'}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (value ?? 0) >= star;
        const icon = (
          <Icon
            name={filled ? 'star' : 'star-outline'}
            size={size}
            color={filled ? 'accent' : 'muted'}
          />
        );
        return onChange ? (
          <Pressable
            key={star}
            accessibilityRole="button"
            accessibilityLabel={`${star} ${star === 1 ? 'estrela' : 'estrelas'}`}
            onPress={() => onChange(value === star ? null : star)}
            className="h-11 w-11 items-center justify-center">
            {icon}
          </Pressable>
        ) : (
          <View key={star}>{icon}</View>
        );
      })}
    </View>
  );
}
