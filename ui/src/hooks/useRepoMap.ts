import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getRepoMapStatus, repoMapToKnowledge } from '../lib/api'

export function useRepoMapStatus(projectName: string) {
  return useQuery({
    queryKey: ['repo-map-status', projectName],
    queryFn: () => getRepoMapStatus(projectName),
    staleTime: 5_000,
  })
}

export function useRepoMapToKnowledge(projectName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: Parameters<typeof repoMapToKnowledge>[1]) => repoMapToKnowledge(projectName, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repo-map-status', projectName] })
    },
  })
}

