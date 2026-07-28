/**
 * src/features/wash/useNearbyWashes.ts
 *
 * C1's data. Server cache in TanStack Query, sort and search applied on top —
 * neither of those is worth a round trip when the radius already bounds the
 * result set.
 */
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { filterWashes, sortWashes, type SortMode } from '@/core/usecases/sortWashes';
import { getNearbyWashes } from '@/data/repositories/WashRepository';
import type { Coords } from '@/hooks/useLocation';

/** C2 offers 1/3/5/10 km; the last step exists for "widen the search". */
export const RADIUS_STEPS_M = [1000, 3000, 5000, 10_000, 25_000] as const;
export const DEFAULT_RADIUS_M = 10_000;

export function nextRadius(current: number): number | null {
  const wider = RADIUS_STEPS_M.find((step) => step > current);
  return wider ?? null;
}

export function useNearbyWashes({
  coords,
  radiusM,
  sort,
  query,
}: {
  coords: Coords | null;
  radiusM: number;
  sort: SortMode;
  query: string;
}) {
  const result = useQuery({
    // Coordinates are rounded into the key so a metre of GPS drift does not
    // invalidate the cache on every reading.
    queryKey: [
      'nearbyWashes',
      coords === null ? null : coords.latitude.toFixed(3),
      coords === null ? null : coords.longitude.toFixed(3),
      radiusM,
    ],
    enabled: coords !== null,
    queryFn: async () => {
      if (coords === null) return [];

      const response = await getNearbyWashes({ ...coords, radiusM });
      // TanStack decides retry and error state from a thrown error; the
      // repository's typed failures have to become one here.
      if (!response.ok) throw new Error(response.reason);
      return response.value;
    },
  });

  const washes = useMemo(
    () => sortWashes(filterWashes(result.data ?? [], query), sort),
    [result.data, query, sort],
  );

  return {
    washes,
    /** the unfiltered count, so "no results" can tell a bad search from an empty area */
    totalCount: result.data?.length ?? 0,
    isLoading: result.isPending && coords !== null,
    isError: result.isError,
    refetch: result.refetch,
  };
}
