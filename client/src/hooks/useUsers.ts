import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, getUser, getUserFriends, createUser } from '../lib/api'

export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
  })
}

export function useUser(id: string) {
  return useQuery({
    queryKey: ['users', id],
    queryFn: () => getUser(id),
    enabled: !!id,
  })
}

export function useUserFriends(userId: string | null) {
  return useQuery({
    queryKey: ['friends', userId],
    queryFn: () => getUserFriends(userId!),
    enabled: !!userId,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { email: string; name: string }) => createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
