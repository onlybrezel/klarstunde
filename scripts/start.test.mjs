import { createServer } from 'node:net'
import { mkdtemp, mkdir, writeFile, rm, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { browserCommand, checkNodeVersion, checkPort, localAddress, needsBuild } from './start.mjs'

const temporary = []
afterEach(async () => {
  for (const directory of temporary.splice(0)) {
    if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('klarstunde-start-')) throw new Error('Unexpected fixture path')
    await rm(directory, { recursive: true, force: true })
  }
})

describe('cross-platform starter', () => {
  it('validates the runtime, local binding and ports', () => {
    expect(() => checkNodeVersion('24.16.0')).not.toThrow()
    expect(() => checkNodeVersion('22.0.0')).toThrow('Node.js 24')
    expect(localAddress({})).toEqual({ host: '127.0.0.1', port: 4173, url: 'http://127.0.0.1:4173' })
    expect(localAddress({ HOST: '::1', PORT: '4184' }).url).toBe('http://[::1]:4184')
    for (const PORT of ['0', '65536', '-2', '1.5', 'abc']) expect(() => localAddress({ PORT })).toThrow('PORT')
    expect(() => localAddress({ HOST: '0.0.0.0' })).toThrow('lokalen Betrieb')
  })
  it('opens Windows and Linux browsers with argument arrays rather than a shell command', () => {
    expect(browserCommand('linux', 'http://127.0.0.1:4173')).toEqual(['xdg-open', ['http://127.0.0.1:4173']])
    expect(browserCommand('win32', 'http://127.0.0.1:4173')).toEqual(['rundll32.exe', ['url.dll,FileProtocolHandler', 'http://127.0.0.1:4173']])
  })
  it('reports an occupied port without contacting or killing the existing application', async () => {
    const server = createServer()
    await new Promise((done) => server.listen(0, '127.0.0.1', done))
    const { port } = server.address()
    try { await expect(checkPort('127.0.0.1', port)).rejects.toThrow('bereits belegt'); expect(server.listening).toBe(true) }
    finally { await new Promise((done) => server.close(done)) }
    await expect(checkPort('127.0.0.1', port)).resolves.toBeUndefined()
  })
  it('rebuilds for missing assets and changed source, while reusing an unchanged build', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'klarstunde-start-'))
    temporary.push(directory)
    expect(await needsBuild(directory)).toBe(true)
    await mkdir(join(directory, 'src'), { recursive: true })
    await mkdir(join(directory, 'dist/client/assets'), { recursive: true })
    for (const name of ['package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'src/app.ts']) await writeFile(join(directory, name), '')
    const index = join(directory, 'dist/client/index.html')
    await writeFile(index, '<script src="/assets/app.js"></script>')
    expect(await needsBuild(directory)).toBe(true)
    await writeFile(join(directory, 'dist/client/assets/app.js'), '')
    const builtAt = new Date(Date.now() + 5000)
    await utimes(index, builtAt, builtAt)
    expect(await needsBuild(directory)).toBe(false)
    await utimes(join(directory, 'src/app.ts'), new Date(Date.now() + 10000), new Date(Date.now() + 10000))
    expect(await needsBuild(directory)).toBe(true)
  })
})
