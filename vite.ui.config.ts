import config from './vite.config.js'

// UI tests serve only the built client; no requests are forwarded to a live backend.
export default { ...config, preview: { host: '127.0.0.1', port: 5188, strictPort: true, proxy: {} } }
