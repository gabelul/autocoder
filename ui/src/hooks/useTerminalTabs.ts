import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createTerminal, deleteTerminal, listTerminals, renameTerminal } from '../lib/api'

export function useTerminalTabs(projectName: string) {
  return useQuery({
    queryKey: ['terminal-tabs', projectName],
    queryFn: () => listTerminals(projectName),
    staleTime: 1000,
    refetchInterval: false,
  })
}

export function useCreateTerminal(projectName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name?: string) => createTerminal(projectName, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['terminal-tabs', projectName] })
    },
  })
}

export function useRenameTerminal(projectName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { terminalId: string; name: string }) => renameTerminal(projectName, args.terminalId, args.name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['terminal-tabs', projectName] })
    },
  })
}

export function useDeleteTerminal(projectName: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (terminalId: string) => deleteTerminal(projectName, terminalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['terminal-tabs', projectName] })
    },
  })
}

