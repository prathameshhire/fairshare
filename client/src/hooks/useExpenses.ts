import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenses, getExpense, createExpense } from '../lib/api'
import type { CreateExpenseInput } from '../types'

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: getExpenses,
  })
}

export function useExpense(id: string) {
  return useQuery({
    queryKey: ['expenses', id],
    queryFn: () => getExpense(id),
    enabled: !!id,
  })
}

export function useCreateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateExpenseInput) => createExpense(data),
    onSuccess: () => {
      // After creating an expense, tell React Query to re-fetch the expenses list
      qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}
