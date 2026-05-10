import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenses, getExpense, createExpense, updateExpense, deleteExpense } from '../lib/api'
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
      // After creating, refresh both the list AND any user's balances —
      // a new expense changes who owes whom.
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['balances'] })
    },
  })
}

export function useUpdateExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateExpenseInput }) =>
      updateExpense(id, data),
    onSuccess: () => {
      // Edit can change amounts AND participants → both list and detail
      // queries need refreshing, plus balances.
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['balances'] })
    },
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteExpense(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['balances'] })
    },
  })
}
