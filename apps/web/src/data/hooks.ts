import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import type { Trip, TripSummary } from '@trip-atlas/schema'
import type { TripRepository } from './TripRepository.ts'

export const RepositoryContext = createContext<TripRepository | null>(null)

export function useRepository(): TripRepository {
  const repo = useContext(RepositoryContext)
  if (!repo) throw new Error('RepositoryContext 未提供，检查 main.tsx')
  return repo
}

export function useTripList(): UseQueryResult<TripSummary[]> {
  const repo = useRepository()
  return useQuery({ queryKey: ['trips'], queryFn: () => repo.listTrips() })
}

export function useTrip(id: string | undefined): UseQueryResult<Trip> {
  const repo = useRepository()
  return useQuery({
    queryKey: ['trip', id],
    queryFn: () => repo.getTrip(id as string),
    enabled: Boolean(id),
  })
}
