import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir, readFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
class StartError extends Error {}

export function checkNodeVersion(version) {
  if (Number(version.split('.')[0]) !== 24) throw new StartError('Klarstunde benötigt Node.js 24. Bitte die passende Version von https://nodejs.org installieren.')
}

export function localAddress(env) {
  const host = env.HOST || '127.0.0.1'
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new StartError('Der Starter ist für lokalen Betrieb gedacht. Bitte HOST auf 127.0.0.1 setzen.')
  const port = env.PORT === undefined || env.PORT === '' ? 4173 : Number(env.PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new StartError('PORT muss eine ganze Zahl zwischen 1 und 65535 sein.')
  return { host, port, url: `http://${host === '::1' ? '[::1]' : host}:${port}` }
}

export function browserCommand(platform, url) {
  return platform === 'win32' ? ['rundll32.exe', ['url.dll,FileProtocolHandler', url]]
    : platform === 'linux' ? ['xdg-open', [url]] : ['open', [url]]
}

export async function checkPort(host, port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer()
    server.once('error', (error) => reject(new StartError(error.code === 'EADDRINUSE'
      ? `Port ${port} ist bereits belegt. Falls Klarstunde schon läuft, öffne die vorhandene Instanz. Andernfalls beende den anderen Dienst oder wähle einen anderen PORT in der .env.`
      : 'Die lokale Adresse kann nicht geöffnet werden. Bitte HOST und PORT prüfen.')))
    server.listen(port, host, () => server.close((error) => error ? reject(new StartError('Die Portprüfung konnte nicht abgeschlossen werden.')) : resolvePort()))
  })
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(entries.map((entry) => entry.isDirectory() ? sourceFiles(join(directory, entry.name))
    : /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name) ? [] : [join(directory, entry.name)]))
  return paths.flat()
}

export async function needsBuild(directory) {
  const index = join(directory, 'dist/client/index.html')
  if (!existsSync(index)) return true
  const html = await readFile(index, 'utf8')
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map((match) => join(directory, 'dist/client', match[1]))
  if (!assets.length || assets.some((asset) => !existsSync(asset))) return true
  const inputs = [...await sourceFiles(join(directory, 'src')), ...['package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json'].map((name) => join(directory, name))]
  const builtAt = (await stat(index)).mtimeMs
  return (await Promise.all(inputs.map((file) => stat(file)))).some((input) => input.mtimeMs > builtAt)
}

function runNode(args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true })
    child.once('error', () => reject(new StartError('Der Build konnte nicht gestartet werden. Bitte pnpm install ausführen.')))
    child.once('exit', (code) => code === 0 ? resolveRun() : reject(new StartError('Der Build ist fehlgeschlagen. Bitte die Meldungen oben prüfen; mit pnpm install die Abhängigkeiten aktualisieren.')))
  })
}

function openBrowser(url) {
  const [command, args] = browserCommand(process.platform, url)
  const child = spawn(command, args, { stdio: 'ignore', detached: true, windowsHide: true })
  const fallback = () => console.log(`Browser konnte nicht automatisch geöffnet werden. Bitte ${url} selbst öffnen.`)
  child.once('error', fallback)
  child.once('exit', (code) => { if (code) fallback() })
  child.unref()
}

export async function main(args = process.argv.slice(2)) {
  if (args.some((arg) => !['--check', '--no-open'].includes(arg))) throw new StartError('Erlaubte Optionen: --check (nur prüfen), --no-open (ohne Browser).')
  checkNodeVersion(process.versions.node)
  if (existsSync(join(root, '.env'))) {
    try { process.loadEnvFile(join(root, '.env')) } catch { throw new StartError('Die .env konnte nicht gelesen werden. Bitte Dateirechte und Format prüfen.') }
  }
  const { host, port, url } = localAddress(process.env)
  process.env.HOST = host
  process.env.PORT = String(port)
  const require = createRequire(join(root, 'package.json'))
  const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  try { for (const dependency of [...Object.keys(manifest.dependencies), 'tsx', 'typescript', 'vite', '@vitejs/plugin-react']) require.resolve(dependency) }
  catch { throw new StartError('Abhängigkeiten fehlen. Bitte im Projektordner einmal pnpm install ausführen und danach erneut starten.') }
  await checkPort(host, port)
  const rebuild = await needsBuild(root)
  if (args.includes('--check')) { console.log(`Startprüfung erfolgreich: Node.js 24, Abhängigkeiten und ${url} verfügbar. ${rebuild ? 'Beim Start wird neu gebaut.' : 'Build ist aktuell.'}`); return }
  if (rebuild) {
    console.log('Klarstunde wird gebaut …')
    await runNode(['node_modules/typescript/bin/tsc', '-b'])
    await runNode(['node_modules/vite/bin/vite.js', 'build'])
  }
  console.log(`Klarstunde startet auf ${url}. Zum Beenden Strg+C drücken.`)
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/server/start.ts'], { cwd: root, stdio: ['inherit', 'pipe', 'inherit'], windowsHide: true })
  const stop = () => child.kill('SIGTERM')
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  let output = ''
  let opened = false
  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk)
    output = (output + chunk.toString()).slice(-1000)
    if (!opened && output.includes('Klarstunde läuft auf ')) {
      opened = true
      if (!args.includes('--no-open')) openBrowser(url)
    }
  })
  await new Promise((resolveServer, reject) => {
    child.once('error', () => reject(new StartError('Der Server konnte nicht gestartet werden. Bitte pnpm install ausführen.')))
    child.once('exit', (code) => {
      process.off('SIGINT', stop)
      process.off('SIGTERM', stop)
      if (code) reject(new StartError('Klarstunde wurde mit einem Fehler beendet. Bitte die Meldungen oben prüfen.'))
      else resolveServer()
    })
  })
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof StartError ? error.message : 'Die Startprüfung ist fehlgeschlagen. Bitte Installation und Dateirechte prüfen.')
    process.exitCode = 1
  })
}
