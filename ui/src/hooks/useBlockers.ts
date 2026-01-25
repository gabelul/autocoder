import { useMutation, useQuery } from '@tanstack/react-query'
import { getBlockersSummary, retryBlockedFeaturesBulk } from '../lib/api'
import type { RetryBlockedRequest } from '../lib/types'

export function useBlockersSummary(projectName: string) {
  return useQuery({
    queryKey: ['blockers-summary', projectName],
    queryFn: () => getBlockersSummary(projectName),
    enabled: Boolean(projectName),
    refetchInterval: 4000,
  })
}

export function useRetryBlockedBulk(projectName: string) {
  return useMutation({
    mutationFn: (req: RetryBlockedRequest) => retryBlockedFeaturesBulk(projectName, req),
  })
}

