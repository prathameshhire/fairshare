import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSettlement } from '../lib/api'
import type { CreateSettlementInput } from '../types'

export function useCreateSettlement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSettlementInput) => createSettlement(data),
    onSuccess: () => {
      // After a settlement, balances and expenses are both stale
      qc.invalidateQueries({ queryKey: ['balances'] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}
