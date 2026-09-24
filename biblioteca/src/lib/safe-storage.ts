import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * AsyncStorage que não quebra na pré-renderização da web (output "static"),
 * onde não existe window/localStorage. Usado pela sessão do Supabase e por
 * preferências locais (biblioteca atual, convite pendente).
 */
const isServer = Platform.OS === 'web' && typeof window === 'undefined';

export const safeStorage = {
  getItem: (key: string) => (isServer ? Promise.resolve(null) : AsyncStorage.getItem(key)),
  setItem: (key: string, value: string) =>
    isServer ? Promise.resolve() : AsyncStorage.setItem(key, value),
  removeItem: (key: string) => (isServer ? Promise.resolve() : AsyncStorage.removeItem(key)),
};
