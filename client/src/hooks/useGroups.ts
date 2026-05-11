import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getGroups,
  getGroup,
  createGroup,
  addGroupMember,
  removeGroupMember,
  updateGroup,
} from '../lib/api'

// ── Reads ──────────────────────────────────────────────────────────────────

// List all groups the logged-in user is a member of
export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: getGroups,
  })
}

// Fetch a single group with its members
export function useGroup(id: string) {
  return useQuery({
    queryKey: ['groups', id],
    queryFn: () => getGroup(id),
    enabled: !!id,
  })
}

// ── Writes ─────────────────────────────────────────────────────────────────
//
// Every mutation invalidates both the list AND the specific group's detail
// query so any open view of the data refreshes immediately.

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createGroup(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

// Add a friend to a group by email
export function useAddGroupMember(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) => addGroupMember(groupId, email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

// Remove a member (or leave a group yourself by passing your own userId)
export function useRemoveGroupMember(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => removeGroupMember(groupId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}

// Rename or archive a group
export function useUpdateGroup(groupId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name?: string; archived?: boolean }) =>
      updateGroup(groupId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['groups'] })
    },
  })
}
