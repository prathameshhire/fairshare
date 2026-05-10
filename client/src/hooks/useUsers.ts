import { useQuery } from '@tanstack/react-query'
import { getUsers, getUser, getUserFriends } from '../lib/api'

// Note: useCreateUser was removed in Session 7. With JWT auth, users create
// themselves via POST /api/auth/register — there's no admin "add person" flow.

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
