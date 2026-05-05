import { useQuery } from '@tanstack/react-query'
import { getBalances } from '../lib/api'

export function useBalances(userId: string | null) {
  return useQuery({
    queryKey: ['balances', userId],
    queryFn: () => getBalances(userId!),
    enabled: !!userId,
  })
}
