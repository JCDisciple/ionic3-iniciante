import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { serif } from '@/components/ui/typography';
import { useChartColors } from '@/hooks/use-palette';

type CelebrationProps = {
  visible: boolean;
  title: string;
  /** Ex.: "Livro nº 12 de 2026" */
  subtitle: string;
  onClose: () => void;
};

const SPARKS = 10;

/** Animação ao concluir um livro. Respeita "reduzir movimento" do sistema. */
export function Celebration({ visible, title, subtitle, onClose }: CelebrationProps) {
  const colors = useChartColors();
  const [scale] = useState(() => new Animated.Value(0.4));
  const [burst] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.4);
    burst.setValue(0);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce) {
        scale.setValue(1);
        burst.setValue(1);
        return;
      }
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
        Animated.timing(burst, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [visible, scale, burst]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 px-8">
        <View className="w-full max-w-sm items-center gap-4 rounded-3xl bg-surface px-6 py-8">
          <View className="h-28 w-28 items-center justify-center">
            {Array.from({ length: SPARKS }, (_, i) => {
              const angle = (i / SPARKS) * Math.PI * 2;
              return (
                <Animated.View
                  key={i}
                  style={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.series[i % colors.series.length],
                    opacity: burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0, 1, 0] }),
                    transform: [
                      {
                        translateX: burst.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, Math.cos(angle) * 56],
                        }),
                      },
                      {
                        translateY: burst.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, Math.sin(angle) * 56],
                        }),
                      },
                    ],
                  }}
                />
              );
            })}
            {/* Animated.View não recebe className do NativeWind: estilos inline. */}
            <Animated.View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.series[0],
                transform: [{ scale }],
              }}>
              <Icon name="book" size={40} color="onAccent" />
            </Animated.View>
          </View>
          <Text
            accessibilityRole="header"
            className="text-center text-2xl font-semibold text-ink"
            style={serif}>
            {title}
          </Text>
          <Text className="text-center text-base text-muted">{subtitle}</Text>
          <Button title="Continuar" onPress={onClose} className="self-stretch" />
        </View>
      </View>
    </Modal>
  );
}
