/**
 * src/features/wash/PinPicker.tsx
 *
 * O1's map step, and O2/O5's "move the pin".
 *
 * A draggable marker rather than a tap-to-place: the owner is standing at
 * the wash, so the map opens on their own position and the pin starts there.
 * Dragging is a correction, not the primary act.
 *
 * The coordinates are shown underneath in Latin digits. That is not
 * decoration — a pin in the sea is the single most likely way to end up with
 * a wash nobody can find, and the number is the only thing that makes it
 * visible before submission.
 */
import Constants from 'expo-constants';
import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import type { Coords } from '@/hooks/useLocation';
import { numeric, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** ~600m across. Close enough to place a building, wide enough to orient. */
const DELTA = 600 / 111_320;

/**
 * Same trap as C1's map: with no Google Maps key an Android MapView is a
 * blank rectangle and nothing says so. Developer-facing, deliberately
 * untranslated — a released build without the key would not have shipped.
 */
function missingAndroidMapsKey(): boolean {
  if (Platform.OS !== 'android') return false;
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  return extra?.hasAndroidMapsKey !== true;
}

export function PinPicker({
  value,
  fallbackCentre,
  onChange,
}: {
  value: Coords | null;
  /** where to open when there is no pin yet — the owner's own position */
  fallbackCentre: Coords | null;
  onChange: (coords: Coords) => void;
}) {
  const { c } = useTheme();

  // Casablanca, only if we have neither a pin nor a fix. Somewhere in
  // Morocco beats the middle of the Atlantic that (0,0) would give.
  const centre = value ?? fallbackCentre ?? { latitude: 33.5749, longitude: -7.5898 };
  const [region] = useState({
    latitude: centre.latitude,
    longitude: centre.longitude,
    latitudeDelta: DELTA,
    longitudeDelta: DELTA,
  });

  if (missingAndroidMapsKey()) {
    return (
      <View style={[styles.missing, { backgroundColor: c.raised, borderColor: c.warn }]}>
        <Text style={[type.caption, { color: c.warn }]}>
          No Google Maps API key — see docs/MAPS.md. The map is blank on Android
          without it.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        onPress={(event) => onChange(event.nativeEvent.coordinate)}
      >
        <Marker
          draggable
          coordinate={value ?? centre}
          onDragEnd={(event) => onChange(event.nativeEvent.coordinate)}
        />
      </MapView>

      {value !== null ? (
        <Text style={[type.caption, numeric, { color: c.textFaint }]}>
          {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { rowGap: spacing.xs },
  map: { height: 260, borderRadius: radii.lg },
  missing: {
    padding: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
