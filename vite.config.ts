import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Lesson markdown is served by the backend (access-controlled), never bundled.
// The frontend only needs to know WHICH lessons exist.
const CONTENT = fileURLToPath(new URL('./content/', import.meta.url))
const ID = 'virtual:published-lessons'

function publishedLessons(): Plugin {
  return {
    name: 'published-lessons',
    resolveId: (id) => (id === ID ? '\0' + ID : undefined),
    load(id) {
      if (id !== '\0' + ID) return
      const ids = readdirSync(CONTENT, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .flatMap((d) =>
          readdirSync(CONTENT + d.name)
            .filter((f) => f.endsWith('.md'))
            .map((f) => `${d.name}/${f.slice(0, -3)}`),
        )
      return `export default ${JSON.stringify(ids)}`
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), publishedLessons()],
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})
