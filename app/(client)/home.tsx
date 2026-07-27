/**
 * app/(client)/home.tsx — C1 · Near you
 *
 * Map on top, list below, map/list toggle, search field, sort bar.
 *
 * States, in the order they take precedence:
 *   offline           banner on top, cached data stays visible (rule 3)
 *   active booking    banner on top, taps through to C6
 *   location off      "Turn on location", then a settings button once the
 *                     OS has stopped offering its own prompt
 *   loading           skeleton rows
 *   error             message with retry
 *   empty             "no car wash open near you" plus widen the search
 *   data              the list, or the map
 *
 * Sorting and searching are pure functions over what the query returned —
 * see src/core/usecases/sortWashes.ts.
 */
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { NearbyWash } from '@/core/domain/CarWash';
import { SORT_MODES, type SortMode } from '@/core/usecases/sortWashes';
import { useActiveBooking } from '@/features/booking/useActiveBooking';
import { DEFAULT_RADIUS_M, nextRadius, useNearbyWashes } from '@/features/wash/useNearbyWashes';
import { WashMap } from '@/features/wash/WashMap';
import { WashRow } from '@/features/wash/WashRow';
import { openAppSettings, useLocation, type Coords } from '@/hooks/useLocation';
import { useOffline } from '@/hooks/useOffline';
import { Banner } from '@/ui/Banner';
import { EmptyState } from '@/ui/EmptyState';
import { SkeletonList } from '@/ui/Skeleton';
import { hitSize, radii, spacing, type } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function NearYouScreen() {
  const { t } = useTranslation();
  const { c } = useTheme();
  const router = useRouter();
  const offline = useOffline();

  const location = useLocation();
  const [radiusM, setRadiusM] = useState(DEFAULT_RADIUS_M);
  const [sort, setSort] = useState<SortMode>('nearest');
  const [query, setQuery] = useState('');
  const [showMap, setShowMap] = useState(false);

  const coords = location.state.status === 'ready' ? location.state.coords : null;
  const { washes, totalCount, isLoading, isError, refetch } = useNearbyWashes({
    coords,
    radiusM,
    sort,
    query,
  });

  const booking = useActiveBooking();
  const wider = nextRadius(radiusM);

  return (
    <SafeAreaView style={[styles.fill, { backgroundColor: c.bg }]}>
      <View style={styles.content}>
        <Text style={[type.title, { color: c.text }]}>{t('queue.near')}</Text>

        {offline ? <Banner message={t('error.offline')} tone="muted" /> : null}

        {booking !== null ? (
          <Pressable accessibilityRole="button" onPress={() => router.push('/(client)/turn')}>
            <Banner
              tone="warn"
              message={t('queue.banner', { wash: booking.washName, number: booking.ticketNo })}
            />
          </Pressable>
        ) : null}

        <Body
          locationStatus={location.state.status}
          onRequestLocation={() => void location.request()}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => void refetch()}
          washes={washes}
          totalCount={totalCount}
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          showMap={showMap}
          onToggleMap={() => setShowMap((previous) => !previous)}
          coords={coords}
          canWiden={wider !== null}
          onWiden={() => {
            if (wider !== null) setRadiusM(wider);
          }}
          onOpenWash={(washId) => router.push(`/(client)/wash/${washId}`)}
        />
      </View>
    </SafeAreaView>
  );
}

type BodyProps = {
  locationStatus: 'loading' | 'ready' | 'denied' | 'unavailable';
  onRequestLocation: () => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  washes: readonly NearbyWash[];
  totalCount: number;
  query: string;
  onQueryChange: (value: string) => void;
  sort: SortMode;
  onSortChange: (mode: SortMode) => void;
  showMap: boolean;
  onToggleMap: () => void;
  coords: Coords | null;
  canWiden: boolean;
  onWiden: () => void;
  onOpenWash: (washId: string) => void;
};

function Body(props: BodyProps) {
  const { t } = useTranslation();
  const { c } = useTheme();

  // Nothing below this works without a position, so it comes first.
  if (props.locationStatus === 'denied' || props.locationStatus === 'unavailable') {
    const permanentlyDenied = props.locationStatus === 'unavailable';

    return (
      <EmptyState
        message={t('empty.locationOff')}
        // A first refusal can be asked again. Once the OS has stopped
        // offering its prompt, asking again does nothing visible and the only
        // honest button is the one that opens Settings.
        actionLabel={permanentlyDenied ? t('wash.openSettings') : t('wash.turnOnLocation')}
        onAction={permanentlyDenied ? () => void openAppSettings() : props.onRequestLocation}
      />
    );
  }

  if (props.locationStatus === 'loading' || props.isLoading) {
    return (
      <View style={styles.list}>
        <SkeletonList rows={6} />
      </View>
    );
  }

  if (props.isError) {
    return (
      <EmptyState
        message={t('error.generic')}
        actionLabel={t('common.retry')}
        onAction={props.onRetry}
      />
    );
  }

  return (
    <>
      <View style={styles.controls}>
        <TextInput
          value={props.query}
          onChangeText={props.onQueryChange}
          placeholder={t('wash.searchPlaceholder')}
          placeholderTextColor={c.textFaint}
          style={[
            type.body,
            styles.search,
            { backgroundColor: c.surface, borderColor: c.line, color: c.text },
          ]}
        />

        <Chip
          label={props.showMap ? t('wash.showList') : t('wash.showMap')}
          selected={props.showMap}
          onPress={props.onToggleMap}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortBar}
      >
        {SORT_MODES.map((mode) => (
          <Chip
            key={mode}
            label={t(SORT_LABEL[mode])}
            selected={props.sort === mode}
            onPress={() => props.onSortChange(mode)}
          />
        ))}
      </ScrollView>

      <Results {...props} />
    </>
  );
}

function Results(props: BodyProps) {
  const { t } = useTranslation();

  if (props.washes.length === 0) {
    // A search that matched nothing is a different problem from an empty
    // area, and the way out of each is different.
    return props.totalCount > 0 ? (
      <EmptyState
        message={t('wash.noMatch')}
        actionLabel={t('common.close')}
        onAction={() => props.onQueryChange('')}
      />
    ) : (
      <EmptyState
        message={t('empty.noWash')}
        actionLabel={props.canWiden ? t('wash.widenSearch') : undefined}
        onAction={props.canWiden ? props.onWiden : undefined}
      />
    );
  }

  if (props.showMap && props.coords !== null) {
    return <WashMap centre={props.coords} washes={props.washes} onSelect={props.onOpenWash} />;
  }

  return (
    <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
      {props.washes.map((wash) => (
        <WashRow key={wash.id} wash={wash} onPress={() => props.onOpenWash(wash.id)} />
      ))}
    </ScrollView>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.primary : c.surface,
          borderColor: selected ? c.primary : c.line,
        },
      ]}
    >
      <Text style={[type.label, { color: selected ? c.onPrimary : c.text }]}>{label}</Text>
    </Pressable>
  );
}

const SORT_LABEL: Record<SortMode, string> = {
  nearest: 'wash.sortNearest',
  fastest: 'wash.sortFastest',
  cheapest: 'wash.sortCheapest',
  rated: 'wash.sortRated',
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flex: 1,
    padding: spacing.lg,
    rowGap: spacing.md,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: spacing.sm,
  },
  search: {
    flex: 1,
    minHeight: hitSize.min,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sortBar: {
    columnGap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    minHeight: hitSize.min,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: spacing.xl },
});
