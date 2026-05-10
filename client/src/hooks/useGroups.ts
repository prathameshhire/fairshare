import { useQuery } from '@tanstack/react-query'
import { getGroups, getGroup } from '../lib/api'

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
