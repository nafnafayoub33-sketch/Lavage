/** Trades and cities. Public, cached hard — an admin changes them rarely. */

import { useQuery } from '@tanstack/react-query'

import { api } from '@/data/client'
import type { City, Trade } from '@/data/types'

export function useTrades() {
  return useQuery({
    queryKey: ['trades'],
    queryFn: () => api<Trade[]>('/trades', { authenticated: false }),
    staleTime: 60 * 60_000,
  })
}

export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: () => api<City[]>('/cities', { authenticated: false }),
    staleTime: 60 * 60_000,
  })
}
