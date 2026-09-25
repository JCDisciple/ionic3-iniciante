import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';

import { BookCover } from '@/components/book-cover';
import { Icon } from '@/components/ui/icon';
import { usePalette } from '@/hooks/use-palette';
import { uploadCover } from '@/lib/books';

type CoverPickerProps = {
  libraryId: string;
  title: string;
  authors: string[];
  coverUrl: string | null;
  onChange: (url: string | null) => void;
};

/** Capa grande com opções de foto (câmera ou galeria), enviada ao Storage. */
export function CoverPicker({ libraryId, title, authors, coverUrl, onChange }: CoverPickerProps) {
  const palette = usePalette();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(source: 'camera' | 'library') {
    setError(null);
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [2, 3],
      quality: 0.7,
    };
    if (source === 'camera' && Platform.OS !== 'web') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError('Permita o acesso à câmera para fotografar a capa.');
        return;
      }
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);
    try {
      onChange(await uploadCover(libraryId, asset.uri, asset.mimeType ?? 'image/jpeg'));
    } catch {
      setError('Não foi possível enviar a foto. Tente de novo.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <View className="items-center gap-3">
      <View>
        <BookCover
          book={{ title: title || 'Sem título', authors, cover_url: coverUrl }}
          width={150}
        />
        {uploading ? (
          <View className="absolute inset-0 items-center justify-center rounded-lg bg-black/40">
            <ActivityIndicator color={palette.onAccent} />
          </View>
        ) : null}
      </View>
      <View className="flex-row gap-2">
        <CoverButton icon="camera-outline" label="Fotografar" onPress={() => pick('camera')} />
        <CoverButton icon="images-outline" label="Galeria" onPress={() => pick('library')} />
        {coverUrl ? (
          <CoverButton icon="trash-outline" label="Remover" onPress={() => onChange(null)} />
        ) : null}
      </View>
      {error ? <Text className="text-sm text-danger">{error}</Text> : null}
    </View>
  );
}

function CoverButton({
  icon,
  label,
  onPress,
}: {
  icon: 'camera-outline' | 'images-outline' | 'trash-outline';
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="min-h-[44px] flex-row items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 active:opacity-80">
      <Icon name={icon} size={18} color="muted" />
      <Text className="text-sm text-ink">{label}</Text>
    </Pressable>
  );
}
