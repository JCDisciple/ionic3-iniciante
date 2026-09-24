import { View, type ViewProps } from 'react-native';

type CardProps = ViewProps & {
  className?: string;
  /** Sem padding interno, para listas cujas linhas já têm o próprio espaçamento. */
  flush?: boolean;
};

export function Card({ className = '', flush = false, ...props }: CardProps) {
  return (
    <View
      className={`rounded-card border border-line bg-surface ${flush ? 'overflow-hidden' : 'p-4'} ${className}`}
      {...props}
    />
  );
}
