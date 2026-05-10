import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUserFriendships, createFriendship, updateFriendship } from '../lib/api'

export function useUserFriendships(userId: string | null) {
  return useQuery({
    queryKey: ['friendships', userId],
    queryFn: () => getUserFriendships(userId!),
    enabled: !!userId,
  })
}

// Friend requests are sent by EMAIL — the server looks up the recipient.
// Throws if no account has that email (the form will catch it and show an error).
export function useSendFriendRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => createFriendship(email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friendships'] })
      qc.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}

export function useRespondToFriendRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'accepted' | 'declined' }) =>
      updateFriendship(id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friendships'] })
      qc.invalidateQueries({ queryKey: ['friends'] })
    },
  })
}
