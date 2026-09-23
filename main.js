process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'

import './config.js'
import { createRequire } from 'module'
import path, { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, mkdirSync, watch } from 'fs'
import { spawn } from 'child_process'
import lodash from 'lodash'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import { tmpdir } from 'os'
import { format } from 'util'
import pino from 'pino'
import { makeWASocket, protoType, serialize } from './lib/simple.js'
import { Low, JSONFile } from 'lowdb'
import readline from 'readline'
import NodeCache from 'node-cache'

const baileys = await import('@whiskeysockets/baileys')
const B = baileys.default || baileys
const makeCacheableSignalKeyStore = B.makeCacheableSignalKeyStore || baileys.makeCacheableSignalKeyStore
const useMultiFileAuthState = B.useMultiFileAuthState || baileys.useMultiFileAuthState
const DisconnectReason = B.DisconnectReason || baileys.DisconnectReason
const fetchLatestBaileysVersion = B.fetchLatestBaileysVersion || baileys.fetchLatestBaileysVersion

const { chain } = lodash

protoType()
serialize()

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString()
}
global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true))
}
global.__require = function require(dir = import.meta.url) {
  return createRequire(dir)
}

const __dirname = global.__dirname(import.meta.url)
const argv = process.argv.slice(2)
global.opts = {}
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  if (!arg.startsWith('--')) continue
  const key = arg.slice(2)
  if (!key) continue
  const next = argv[i + 1]
  if (next && !next.startsWith('--')) {
    global.opts[key] = next
    i++
  } else {
    global.opts[key] = true
  }
}

const prefixValue = global.opts.prefix || '‎z/#$%.\\-'
global.prefix = new RegExp('^[' + String(prefixValue).replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']')

const storageDir = join(__dirname, 'storage', 'databases')
mkdirSync(storageDir, { recursive: true })
const dbFile = join(storageDir, 'database.json')

global.db = new Low(new JSONFile(dbFile))
global.DATABASE = global.db

global.loadDatabase = async function loadDatabase() {
  if (global.db.READ) {
    return new Promise(resolve => {
      const timer = setInterval(() => {
        if (!global.db.READ) {
          clearInterval(timer)
          resolve(global.db.data || global.loadDatabase())
        }
      }, 100)
    })
  }

  if (global.db.data !== null) return global.db.data

  global.db.READ = true
  try {
    await global.db.read()
  } catch (error) {
    if (error?.code !== 'ENOENT') console.error('[DB] Error leyendo database.json:', error)
  } finally {
    global.db.READ = false
  }

  global.db.data = {
    users: {},
    chats: {},
    stats: {},
    msgs: {},
    sticker: {},
    settings: {},
    ...(global.db.data || {})
  }
  global.db.chain = chain(global.db.data)
  return global.db.data
}

await global.loadDatabase()

const sessionsDir = join(__dirname, 'sessions')
mkdirSync(sessionsDir, { recursive: true })

const question = text => new Promise(resolve => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  rl.question(text, answer => {
    rl.close()
    resolve(answer)
  })
})

const { state, saveCreds } = await useMultiFileAuthState(sessionsDir)

const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0, useClones: false })
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0, useClones: false })
const mediaCache = new NodeCache({ stdTTL: 0, checkperiod: 0, useClones: false })
global.groupMetadataCache = new NodeCache({ stdTTL: 60, checkperiod: 30, useClones: false })

global.cachedGroupMetadata = async function (jid) {
  if (!jid?.endsWith('@g.us')) return {}
  const cached = global.groupMetadataCache.get(jid)
  if (cached) return cached

  try {
    const metadata = await global.conn.groupMetadata(jid)
    global.groupMetadataCache.set(jid, metadata)
    return metadata
  } catch (error) {
    console.error('[cachedGroupMetadata]', error?.message || error)
    return {}
  }
}

const logger = pino({ level: process.env.LOG_LEVEL || 'silent' })

let baileysVersion
try {
  if (fetchLatestBaileysVersion) {
    const latest = await fetchLatestBaileysVersion()
    baileysVersion = latest?.version
  }
} catch (error) {
  console.warn('[Baileys] No se pudo consultar la versión más reciente:', error?.message || error)
}

const connectionOptions = {
  logger,
  printQRInTerminal: false,
  mobile: false,
  emitOwnEvents: true,
  keepAliveIntervalMs: 20000,
  mediaCache,
  msgRetryCounterCache,
  userDevicesCache,
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, logger)
  },
  getMessage: async () => undefined,
  generateHighQualityLinkPreview: true,
  shouldSyncHistoryMessage: () => false,
  syncFullHistory: false,
  markOnlineOnConnect: false,
  defaultQueryTimeoutMs: 60000,
  connectTimeoutMs: 60000,
  qrTimeout: 60000,
  ...(baileysVersion ? { version: baileysVersion } : {}),
  browser: ['Windows', 'Chrome', '120.0.0'],
  cachedGroupMetadata: global.cachedGroupMetadata
}

let conn = null
let handler = null
let isInit = false
let restarting = false

async function createConnection() {
  if (conn) {
    try { conn.ev.removeAllListeners() } catch {}
    try { conn.ws?.close() } catch {}
  }

  conn = global.conn = makeWASocket(connectionOptions)
  conn.isInit = false
  conn.well = false

  if (!state.creds.registered) {
    let phoneNumber = await question(chalk.blue('Ingresa el número de WhatsApp para vincular el bot (ej. 504XXXXXXXX):\n'))
    phoneNumber = phoneNumber.replace(/\D/g, '')

    if (!phoneNumber) throw new Error('Número de WhatsApp inválido.')

    if (!conn.requestPairingCode) {
      throw new Error('Esta versión de Baileys no soporta código de vinculación.')
    }

    // Baileys necesita unos instantes para abrir el WebSocket antes de
    // solicitar el código de vinculación. Pedirlo inmediatamente puede
    // producir: "Error: Connection Closed".
    await new Promise(resolve => setTimeout(resolve, 3000))

    let code
    try {
      code = await conn.requestPairingCode(phoneNumber)
    } catch (error) {
      console.error(chalk.red('❌ No se pudo solicitar el código de vinculación:', error?.message || error))
      console.error(chalk.gray('La conexión de WhatsApp se cerró antes de responder. Se reintentará mediante connection.update.'))
      return conn
    }

    console.log(chalk.magenta(`Código de vinculación: ${String(code).match(/.{1,4}/g)?.join('-') || code}`))
  }

  return conn
}

async function connectionUpdate(update) {
  const { connection, lastDisconnect, isNewLogin } = update || {}

  if (isNewLogin) conn.isInit = true

  if (connection === 'open') {
    global.botStartTime = Math.floor(Date.now() / 1000)
    console.log(chalk.green('✅ Conectado correctamente.'))
    return
  }

  if (connection !== 'close' || restarting) return

  const code =
    lastDisconnect?.error?.output?.statusCode ??
    lastDisconnect?.error?.output?.payload?.statusCode

  if (code === DisconnectReason?.loggedOut) {
    console.error(chalk.red('❌ Sesión cerrada. Borra la carpeta sessions y vuelve a vincularla si quieres cambiar de cuenta.'))
    return
  }

  console.warn(chalk.yellow(`⚠️ Conexión cerrada${code ? ` (código ${code})` : ''}. Reconectando...`))

  await restartConnection()
}

async function restartConnection() {
  if (restarting) return
  restarting = true

  try {
    await new Promise(resolve => setTimeout(resolve, 2000))
    await createConnection()
    await attachHandlers()
  } catch (error) {
    console.error('[RESTART]', error)
    setTimeout(() => restartConnection().catch(console.error), 5000)
  } finally {
    restarting = false
  }
}

async function attachHandlers() {
  if (!handler) handler = await import('./handler.js')

  conn.handler = handler.handler.bind(conn)
  conn.connectionUpdate = connectionUpdate.bind(conn)
  conn.credsUpdate = saveCreds

  conn.ev.on('messages.upsert', conn.handler)
  conn.ev.on('connection.update', conn.connectionUpdate)
  conn.ev.on('creds.update', conn.credsUpdate)
  isInit = true
}

global.reloadHandler = async function (restart = false) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`)
    if (Handler?.handler) handler = Handler
  } catch (error) {
    console.error('[HANDLER] No se pudo recargar:', error)
    return false
  }

  if (restart) {
    await restartConnection()
    return true
  }

  if (conn && isInit) {
    conn.ev.off('messages.upsert', conn.handler)
    conn.ev.off('connection.update', conn.connectionUpdate)
    conn.ev.off('creds.update', conn.credsUpdate)
    await attachHandlers()
  }

  return true
}

const pluginFolder = join(__dirname, './plugins')
const pluginFilter = filename => /\.js$/.test(filename)
global.plugins = {}

async function loadPlugin(filename) {
  const dir = join(pluginFolder, filename)

  if (!existsSync(dir)) return false

  try {
    const err = syntaxerror(readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true
    })

    if (err) {
      console.error(`❗ Error de sintaxis en ${filename}:`, format(err))
      return false
    }

    const module = await import(`${pathToFileURL(dir).href}?update=${Date.now()}`)
    global.plugins[filename] = module.default || module
    return true
  } catch (error) {
    console.error(`❌ No se pudo cargar plugin ${filename}:`, error?.stack || error)
    delete global.plugins[filename]
    return false
  }
}

async function filesInit() {
  const files = readdirSync(pluginFolder)
    .filter(pluginFilter)
    .sort()

  for (const filename of files) {
    await loadPlugin(filename)
  }

  console.log(chalk.cyan(`📦 Plugins cargados: ${Object.keys(global.plugins).length}/${files.length}`))
}

await filesInit()

global.reload = async (_event, filename) => {
  if (!pluginFilter(filename)) return
  await loadPlugin(filename)
}

Object.freeze(global.reload)

try {
  watch(pluginFolder, global.reload)
} catch (error) {
  console.error('[PLUGINS] No se pudo activar el watcher:', error)
}

global.dbDirty = false

if (!global.opts.test) {
  setInterval(async () => {
    if (!global.dbDirty || !global.db.data) return
    try {
      await global.db.write()
      global.dbDirty = false
    } catch (error) {
      console.error('[DB] Error guardando:', error)
    }
  }, 30000)
}

async function clearTmp() {
  const dirs = [tmpdir(), join(__dirname, './tmp')]

  for (const dir of dirs) {
    if (!existsSync(dir)) continue

    for (const file of readdirSync(dir)) {
      const full = join(dir, file)
      try {
        const stats = statSync(full)
        if (stats.isFile() && Date.now() - stats.mtimeMs >= 60_000) {
          unlinkSync(full)
        }
      } catch {}
    }
  }
}

setInterval(() => clearTmp().catch?.(console.error), 5 * 60 * 1000)

process.on('uncaughtException', error => {
  console.error('❌ uncaughtException:', error?.stack || error)
})

process.on('unhandledRejection', error => {
  console.error('❌ unhandledRejection:', error?.stack || error)
})

await createConnection()
await attachHandlers()

console.log(chalk.green('🚀 Bot iniciado.'))
