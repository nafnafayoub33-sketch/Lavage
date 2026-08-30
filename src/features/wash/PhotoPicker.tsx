/**
 * src/features/wash/PhotoPicker.tsx
 *
 * O1's photo step, and O2/O5's edit.
 *
 * Holds local file URIs and already-uploaded public URLs in the same list —
 * an <Image> renders either, and the save decides which ones still need
 * uploading (see isUploaded in StorageRepository). Anything else would mean
 * the owner losing their existing photos every time they open the form.
 */
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MAX_PHOTOS, MIN_PHOTOS } from '@/core/usecases/washApplication';
import { hitSize, numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { Button } from '@/ui/Button';

export function PhotoPicker({
  photos,
  onChange,
}: {
  photos: readonly string[];
  onChange: (next: readonly string[]) => void;
}) {
  const { t } = useTranslation();
  const { c } = useTheme();

  const remaining = MAX_PHOTOS - photos.length;

  const add = async () => {
    if (remaining <= 0) return;

    // The library, not the camera: an owner setting up in the evening is
    // very often working from shots they already took in daylight.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('owner.photosPermission'), undefined, [{ text: t('common.close') }]);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.7,
    });

    if (result.canceled) return;
    onChange([...photos, ...result.assets.map((asset) => asset.uri)].slice(0, MAX_PHOTOS));
  };

  const remove = (uri: string) => {
    // Destructive, and one tap from the add button. Confirm.
    Alert.alert(t('owner.removePhoto'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => onChange(photos.filter((photo) => photo !== uri)),
      },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={[type.caption, numeric, { color: c.textMuted }]}>
        {t('owner.photosCount', { count: photos.length, min: MIN_PHOTOS })}
      </Text>

      {photos.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.strip}>
            {photos.map((uri) => (
              <Pressable
                key={uri}
                accessibilityRole="button"
                accessibilityLabel={t('owner.removePhoto')}
                onPress={() => remove(uri)}
                style={styles.thumbWrap}
              >
                <Image
                  source={{ uri }}
                  style={[styles.thumb, { backgroundColor: c.raised }]}
                  resizeMode="cover"
                />
                <View style={[styles.remove, { backgroundColor: c.bad }]}>
                  <Text style={[type.label, { color: c.onPrimary }]}>×</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : null}

      <Button
        label={t('owner.addPhotos')}
        variant="secondary"
        size="owner"
        disabled={remaining <= 0}
        onPress={() => void add()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { rowGap: spacing.sm },
  strip: { flexDirection: 'row', columnGap: spacing.sm },
  thumbWrap: { position: 'relative' },
  thumb: { width: 110, height: 84, borderRadius: radii.md },
  remove: {
    position: 'absolute',
    top: spacing.xs,
    insetInlineEnd: spacing.xs,
    minWidth: hitSize.min / 2,
    height: hitSize.min / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
});
