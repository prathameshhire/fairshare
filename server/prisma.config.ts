import 'dotenv/config'
import path from 'path'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: process.env.DIRECT_URL!,
  },
  migrate: {
    async adapter() {
      const { PrismaNeon } = await import('@prisma/adapter-neon')
      const { Pool } = await import('@neondatabase/serverless')
      const pool = new Pool({
        connectionString: process.env.DIRECT_URL,
      })
      return new PrismaNeon(pool)
    },
  },
})