/**
 * src/features/wash/WashMap.tsx
 *
 * C1's map half: pins coloured by queue state.
 *
 * Pin colours come from queueStateFor() and queueColor(), the same pair the
 * list rows use — a wash must not read amber in the list and green on the
 * map.
 */
import Constants from 'expo-constants';
import { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import type { NearbyWash } from '@/core/domain/CarWash';
import { queueStateFor } from '@/core/usecases/queueState';
import type { Coords } from '@/hooks/useLocation';
import { queueColor, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/**
 * Android has no built-in map provider: with no Google Maps key the MapView
 * renders as a blank rectangle, and neither the build nor the runtime says a
 * word about it. app.config.ts publishes whether the key was set so this can
 * be caught and explained rather than stared at.
 *
 * Developer-facing text, deliberately untranslated — a user can never reach
 * it, because a released build without the key would not have shipped.
 */
function missingAndroidMapsKey(): boolean {
  if (Platform.OS !== 'android') return false;

  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  return extra?.hasAndroidMapsKey !== true;
}

/** Metres per degree of latitude — close enough at Morocco's latitudes. */
const METRES_PER_DEGREE = 111_320;

/** Never zoom closer than ~600m across, however near the nearest wash is. */
const MIN_DELTA = 600 / METRES_PER_DEGREE;

/**
 * Fit the viewport around the user and everything shown, with a margin so the
 * furthest pin is not welded to the edge.
 */
function deltaFor(washes: readonly NearbyWash[]): number {
  const furthest = washes.reduce((max, wash) => Math.max(max, wash.distanceM), 0);
  return Math.max(MIN_DELTA, (furthest * 2.6) / METRES_PER_DEGREE);
}

export function WashMap({
  centre,
  washes,
  onSelect,
}: {
  centre: Coords;
  washes: readonly NearbyWash[];
  onSelect: (washId: string) => void;
}) {
  const { c, scheme } = useTheme();
  const colors = queueColor(c);

  const pins = useMemo(
    () =>
      washes.map((wash) => ({
        wash,
        color: colors[queueStateFor({ waitMinutes: wash.waitMinutes, isOpen: wash.isOpen })],
      })),
    [washes, colors],
  );

  const delta = deltaFor(washes);

  if (missingAndroidMapsKey()) {
    return (
      <View style={[styles.wrap, styles.notice, { borderColor: c.bad, backgroundColor: c.surface }]}>
        <Text style={[type.subtitle, styles.noticeText, { color: c.bad }]}>
          Map unavailable
        </Text>
        <Text style={[type.caption, styles.noticeText, { color: c.textMuted }]}>
          GOOGLE_MAPS_ANDROID_API_KEY is not set. Add it to .env and make a new
          native build — a JS reload will not pick it up. See the README.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { borderColor: c.line }]}>
      <MapView
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        // Honoured by both Apple and Google Maps; without it the map glows
        // white inside a dark screen.
        userInterfaceStyle={scheme}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        region={{
          latitude: centre.latitude,
          longitude: centre.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        }}
      >
        {pins.map(({ wash, color }) => (
          <Marker
            key={wash.id}
            coordinate={{ latitude: wash.latitude, longitude: wash.longitude }}
            title={wash.name}
            pinColor={color}
            onCalloutPress={() => onSelect(wash.id)}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  notice: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    rowGap: spacing.sm,
  },
  noticeText: { textAlign: 'center' },
});

export default WashMap;
