import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Test-only auth mock. Never use this configuration for a production build. */
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'qa-supabase-auth-fixture',
      enforce: 'pre',
      transform(_code, id) {
        if (id.endsWith('/src/lib/supabaseClient.ts')) {
          return `export const supabase = { auth: {
            getSession: async () => ({data: {session: {access_token: 'qa-token-not-real'}}})
          }}`
        }
      },
    },
  ],
  define: { 'import.meta.env.VITE_API_URL': JSON.stringify('http://127.0.0.1:4177/mock') },
  server: { host: '127.0.0.1', port: 4177, strictPort: true },
})
