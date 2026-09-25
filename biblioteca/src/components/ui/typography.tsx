import { Platform, Text, type TextProps } from 'react-native';

type Props = TextProps & { className?: string };

/**
 * Serifa dos títulos ("clima de livro"). Fica em style, e não numa classe do
 * Tailwind, porque cada plataforma precisa de um valor diferente.
 */
export const serif = {
  fontFamily: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    default: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
  }),
};

/** Títulos em serifa ("clima de livro"). */
const HEADING_SIZES = { md: 'text-2xl', lg: 'text-3xl', xl: 'text-4xl' } as const;

/** Tamanho via prop: classes de tamanho conflitantes no className não se sobrepõem. */
export function Heading({
  className = '',
  style,
  size = 'lg',
  ...props
}: Props & { size?: keyof typeof HEADING_SIZES }) {
  return (
    <Text
      accessibilityRole="header"
      className={`${HEADING_SIZES[size]} font-semibold text-ink ${className}`}
      style={[serif, style]}
      {...props}
    />
  );
}

export function Subheading({ className = '', style, ...props }: Props) {
  return (
    <Text
      accessibilityRole="header"
      className={`text-xl font-semibold text-ink ${className}`}
      style={[serif, style]}
      {...props}
    />
  );
}

export function Body({ className = '', ...props }: Props) {
  return <Text className={`text-base leading-6 text-ink ${className}`} {...props} />;
}

export function Muted({ className = '', ...props }: Props) {
  return <Text className={`text-sm leading-5 text-muted ${className}`} {...props} />;
}

export function Label({ className = '', ...props }: Props) {
  return (
    <Text
      className={`text-xs font-semibold uppercase tracking-wider text-muted ${className}`}
      {...props}
    />
  );
}
