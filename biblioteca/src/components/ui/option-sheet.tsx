import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { MaxContentWidth } from '@/constants/theme';

export type SheetOption = { value: string; label: string; hint?: string };

type OptionSheetProps = {
  visible: boolean;
  title: string;
  options: SheetOption[];
  /** Valores marcados (um só quando `multiple` é falso). */
  selected: string[];
  multiple?: boolean;
  onSelect: (value: string) => void;
  onClose: () => void;
  /** Rótulo da opção "limpar" no topo (ex.: "Todos os gêneros"). */
  clearLabel?: string;
  onClear?: () => void;
};

/** Lista de opções em uma folha inferior. */
export function OptionSheet({
  visible,
  title,
  options,
  selected,
  multiple = false,
  onSelect,
  onClose,
  clearLabel,
  onClear,
}: OptionSheetProps) {
  const insets = useSafeAreaInsets();

  function choose(value: string) {
    onSelect(value);
    if (!multiple) onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel="Fechar" className="flex-1 bg-black/40" onPress={onClose} />
      <View
        className="max-h-[75%] w-full self-center rounded-t-3xl bg-surface"
        style={{ maxWidth: MaxContentWidth, paddingBottom: Math.max(insets.bottom, 16) }}>
        <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
          <Text className="text-lg font-semibold text-ink">{title}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={multiple ? 'Concluir' : 'Fechar'}
            onPress={onClose}
            className="h-11 min-w-[44px] items-center justify-center">
            {multiple ? (
              <Text className="text-base font-semibold text-accent">Concluir</Text>
            ) : (
              <Icon name="close" color="muted" />
            )}
          </Pressable>
        </View>
        <ScrollView>
          {clearLabel && onClear ? (
            <OptionRow
              label={clearLabel}
              checked={selected.length === 0}
              onPress={() => {
                onClear();
                if (!multiple) onClose();
              }}
            />
          ) : null}
          {options.map((option) => (
            <OptionRow
              key={option.value}
              label={option.label}
              hint={option.hint}
              checked={selected.includes(option.value)}
              onPress={() => choose(option.value)}
            />
          ))}
          {options.length === 0 ? (
            <Text className="px-5 py-6 text-center text-muted">Nada por aqui ainda.</Text>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function OptionRow({
  label,
  hint,
  checked,
  onPress,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      className="min-h-[52px] flex-row items-center gap-3 px-5 py-2 active:bg-sunken">
      <View className="flex-1">
        <Text className={`text-base ${checked ? 'font-semibold text-accent' : 'text-ink'}`}>
          {label}
        </Text>
        {hint ? <Text className="text-sm text-muted">{hint}</Text> : null}
      </View>
      {checked ? <Icon name="checkmark" size={20} color="accent" /> : null}
    </Pressable>
  );
}
