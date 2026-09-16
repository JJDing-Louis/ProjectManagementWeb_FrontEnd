import { defineConfig, devices } from '@playwright/test'

const frontendPort = process.env.PMW_E2E_FRONTEND_PORT ?? '5173'
const frontendBaseUrl = `http://localhost:${frontendPort}`
const apiBaseUrl = process.env.PMW_E2E_API_BASE_URL ?? 'http://localhost:8080'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: { baseURL: frontendBaseUrl, trace: 'retain-on-failure' },
  webServer: {
    command: `VITE_API_BASE_URL=${apiBaseUrl} npm run dev -- --host localhost --port ${frontendPort}`,
    url: frontendBaseUrl,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
})
