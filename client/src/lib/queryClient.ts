import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30, // data is fresh for 30 seconds before React Query refetches
      retry: 1,
    },
  },
})
