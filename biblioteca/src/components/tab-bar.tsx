import type { BottomTabBarProps } from 'expo-router/tabs';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Platform, Pressable, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/icon';
import { MaxContentWidth } from '@/constants/theme';

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName }> = {
  index: { label: 'Início', icon: 'home-outline', activeIcon: 'home' },
  biblioteca: { label: 'Biblioteca', icon: 'library-outline', activeIcon: 'library' },
  relatorios: { label: 'Relatórios', icon: 'stats-chart-outline', activeIcon: 'stats-chart' },
  perfil: { label: 'Perfil', icon: 'person-circle-outline', activeIcon: 'person-circle' },
};

/**
 * Barra inferior com 4 abas e o botão central flutuante de escanear
 * ("uma mão, dois toques").
 */
export function TabBar({ state, navigation, insets }: BottomTabBarProps) {
  const routes = state.routes.filter((route) => route.name in TABS);
  const half = Math.ceil(routes.length / 2);

  function renderTab(route: (typeof routes)[number]) {
    const tab = TABS[route.name];
    const focused = state.routes[state.index]?.key === route.key;

    function onPress() {
      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
    }

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={tab.label}
        onPress={onPress}
        className="min-h-[52px] flex-1 items-center justify-center gap-0.5">
        <Icon
          name={focused ? tab.activeIcon : tab.icon}
          size={24}
          color={focused ? 'accent' : 'muted'}
        />
        <Text className={`text-[11px] ${focused ? 'font-semibold text-accent' : 'text-muted'}`}>
          {tab.label}
        </Text>
      </Pressable>
    );
  }

  function openScanner() {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/scanner');
  }

  return (
    <View
      className="border-t border-line bg-surface"
      style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
      <View
        className="w-full flex-row items-center self-center px-2 pt-1.5"
        style={{ maxWidth: MaxContentWidth }}>
        {routes.slice(0, half).map(renderTab)}
        <View className="w-20 items-center">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Escanear código de barras"
            onPress={openScanner}
            className="-mt-7 h-16 w-16 items-center justify-center rounded-full bg-accent shadow-lg active:opacity-90"
            style={{ elevation: 6 }}>
            <Icon name="barcode-outline" size={30} color="onAccent" />
          </Pressable>
        </View>
        {routes.slice(half).map(renderTab)}
      </View>
    </View>
  );
}
