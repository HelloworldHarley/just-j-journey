import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query'
import { createContext, useContext } from 'react'
import type { Space, Trip, TripSummary, Visibility } from '@jjj/schema'
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

export function useSpace(): UseQueryResult<Space | null> {
  const repo = useRepository()
  return useQuery({ queryKey: ['space'], queryFn: () => repo.getSpace() })
}

/** 首页开关：改一份行程的 visibility，成功后首页列表与那份行程都重新读（仓库已丢掉它的缓存） */
export function useSetVisibility(): UseMutationResult<void, Error, { id: string; visibility: Visibility }> {
  const repo = useRepository()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, visibility }) => {
      if (!repo.setVisibility) throw new Error('这个数据源没有写路径')
      return repo.setVisibility(id, visibility)
    },
    onSuccess: (_result, { id }) => {
      void qc.invalidateQueries({ queryKey: ['trips'] })
      void qc.invalidateQueries({ queryKey: ['trip', id] })
    },
  })
}
