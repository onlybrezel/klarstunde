import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/ui',
  outputDir: '.data/ui-results',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5188',
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    screenshot: 'only-on-failure',
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
    { name: 'small-mobile', use: { viewport: { width: 320, height: 844 } } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --config vite.ui.config.ts',
    url: 'http://127.0.0.1:5188',
    reuseExistingServer: false,
  },
})
