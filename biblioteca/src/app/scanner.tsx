import { isBookBarcode, parseIsbn } from '@shared/isbn.ts';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeCamera } from '@/components/barcode-camera';
import { Icon } from '@/components/ui/icon';
import { MaxContentWidth } from '@/constants/theme';
import { usePalette } from '@/hooks/use-palette';
import { batchStore, useBatch } from '@/lib/batch-store';
import { vibrateSuccess, vibrateWarning } from '@/lib/feedback';

const REPEAT_WINDOW_MS = 4000;

/**
 * Scanner: câmera em tela cheia lendo EAN-13 de livros. No modo normal abre a
 * pré-visualização; no modo lote empilha os ISBNs para revisar no fim.
 */
export default function ScannerScreen() {
  const palette = usePalette();
  const focused = useIsFocused();
  const params = useLocalSearchParams<{ lote?: string }>();
  const batch = useBatch();
  const [batchMode, setBatchMode] = useState(params.lote === '1' || batch.length > 0);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);
  const lastRead = useRef<{ code: string; at: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pending = batch.filter((item) => item.state !== 'saved').length;

  function showToast(text: string, tone: 'ok' | 'warn') {
    setToast({ text, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function accept(isbn13: string) {
    if (batchMode) {
      const added = batchStore.add(isbn13);
      if (added) {
        vibrateSuccess();
        showToast(`Adicionado à fila (${pending + 1})`, 'ok');
      } else {
        showToast('Este livro já está na fila', 'warn');
      }
      return;
    }
    vibrateSuccess();
    router.push({ pathname: '/livro/novo', params: { isbn: isbn13 } });
  }

  function handleCode(code: string) {
    const now = Date.now();
    if (lastRead.current?.code === code && now - lastRead.current.at < REPEAT_WINDOW_MS) return;
    lastRead.current = { code, at: now };

    if (!isBookBarcode(code)) {
      vibrateWarning();
      showToast('Esse código não é de um livro (ISBN começa com 978 ou 979)', 'warn');
      return;
    }
    accept(code);
  }

  function handleManual() {
    const isbn = parseIsbn(manual);
    if (!isbn) {
      setManualError('ISBN inválido. Confira os dígitos (10 ou 13).');
      return;
    }
    setManualError(null);
    setManual('');
    accept(isbn.isbn13);
  }

  function close() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View className="flex-1 bg-black">
      <BarcodeCamera onCode={handleCode} paused={!focused} />

      {/* Moldura do código */}
      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <View className="h-40 w-72 rounded-3xl border-2 border-white/90" />
        <Text className="mt-4 text-center text-sm text-white/90">
          Aponte para o código de barras do livro
        </Text>
      </View>

      <SafeAreaView edges={['top']} className="absolute left-0 right-0 top-0">
        <View className="flex-row items-center justify-between px-4 py-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar"
            onPress={close}
            className="h-11 w-11 items-center justify-center rounded-full bg-black/50">
            <Icon name="close" color="onAccent" />
          </Pressable>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: batchMode }}
            accessibilityLabel="Modo lote"
            onPress={() => setBatchMode((v) => !v)}
            className={`min-h-[44px] flex-row items-center gap-2 rounded-full px-4 ${
              batchMode ? 'bg-accent' : 'bg-black/50'
            }`}>
            <Icon name="layers-outline" size={18} color="onAccent" />
            <Text className="text-sm font-semibold text-white">
              {batchMode ? 'Modo lote ligado' : 'Modo lote'}
            </Text>
          </Pressable>
        </View>
        {toast ? (
          <View
            accessibilityLiveRegion="polite"
            className={`mx-4 mt-2 self-center rounded-full px-4 py-2 ${
              toast.tone === 'ok' ? 'bg-success' : 'bg-black/80'
            }`}>
            <Text className="text-center text-sm font-semibold text-white">{toast.text}</Text>
          </View>
        ) : null}
      </SafeAreaView>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="absolute bottom-0 left-0 right-0">
        <View className="rounded-t-3xl bg-paper">
          <SafeAreaView edges={['bottom']}>
            <View
              className="w-full gap-3 self-center px-4 pb-2 pt-4"
              style={{ maxWidth: MaxContentWidth }}>
              {batchMode && pending > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/lote')}
                  className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-card bg-accent px-4">
                  <Icon name="list" size={20} color="onAccent" />
                  <Text className="text-base font-semibold text-on-accent">
                    Revisar {pending} {pending === 1 ? 'livro' : 'livros'}
                  </Text>
                </Pressable>
              ) : null}

              <View className="flex-row items-center gap-2">
                <View
                  className={`min-h-[48px] flex-1 flex-row items-center rounded-card border bg-surface px-4 ${
                    manualError ? 'border-danger' : 'border-line'
                  }`}>
                  <TextInput
                    accessibilityLabel="Digitar ISBN"
                    placeholder="Digitar ISBN"
                    placeholderTextColor={palette.muted}
                    value={manual}
                    onChangeText={(text) => {
                      setManual(text);
                      setManualError(null);
                    }}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    returnKeyType="search"
                    onSubmitEditing={handleManual}
                    maxLength={17}
                    className="flex-1 py-3 text-base text-ink"
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Buscar ISBN"
                  onPress={handleManual}
                  className="h-12 w-12 items-center justify-center rounded-card bg-accent">
                  <Icon name="arrow-forward" color="onAccent" />
                </Pressable>
              </View>
              {manualError ? <Text className="text-sm text-danger">{manualError}</Text> : null}

              <View className="flex-row justify-center gap-6 pb-1">
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/livro/buscar')}
                  className="min-h-[44px] flex-row items-center gap-1.5">
                  <Icon name="search" size={18} color="accent" />
                  <Text className="text-sm font-semibold text-accent">Buscar por título</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push('/livro/novo')}
                  className="min-h-[44px] flex-row items-center gap-1.5">
                  <Icon name="create-outline" size={18} color="accent" />
                  <Text className="text-sm font-semibold text-accent">Cadastro manual</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
