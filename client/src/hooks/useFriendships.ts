import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUserFriendships, createFriendship, updateFriendship } from '../lib/api'

export function useUserFriendships(userId: string | null) {
  return useQuery({
    queryKey: ['friendships', userId],
    queryFn: () => getUserFriendships(userId!),
    enabled: !!userId,
  })
}

export function useSendFriendRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ requesterId, addresseeId }: { requesterId: string; addresseeId: string }) =>
      createFriendship(requesterId, addresseeId),
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
