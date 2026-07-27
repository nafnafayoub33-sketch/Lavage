/**
 * src/features/wash/WashMap.tsx
 *
 * C1's map half: pins coloured by queue state.
 *
 * Pin colours come from queueStateFor() and queueColor(), the same pair the
 * list rows use — a wash must not read amber in the list and green on the
 * map.
 */
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

import type { NearbyWash } from '@/core/domain/CarWash';
import { queueStateFor } from '@/core/usecases/queueState';
import type { Coords } from '@/hooks/useLocation';
import { queueColor, radii } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

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
});

export default WashMap;
