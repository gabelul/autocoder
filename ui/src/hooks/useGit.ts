import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getGitStatus, gitStash } from '../lib/api'

export function useGitStatus(projectName: string) {
  return useQuery({
    queryKey: ['git-status', projectName],
    queryFn: () => getGitStatus(projectName),
    staleTime: 5_000,
    refetchInterval: 10_000,
    enabled: Boolean(projectName),
  })
}

export function useGitStash(projectName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: Parameters<typeof gitStash>[1]) => gitStash(projectName, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['git-status', projectName] })
    },
  })
}
