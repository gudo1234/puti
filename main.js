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
let reconnectTimer = null
let reconnectAttempt = 0
let reconnectPending = false

// Estado de actividad/conexión. Evita que un WebSocket muerto o un listener
// perdido deje el bot "conectado" pero sin procesar mensajes.
let connectionGeneration = 0
let lastSocketActivity = Date.now()
let lastMessageActivity = Date.now()
let watchdogTimer = null

function getDisconnectCode(update = {}) {
  const error = update?.lastDisconnect?.error
  return (
    error?.output?.statusCode ??
    error?.output?.payload?.statusCode ??
    error?.statusCode ??
    error?.data?.statusCode ??
    null
  )
}

function closeSocket(socket) {
  if (!socket) return
  try { socket.ev?.removeAllListeners?.() } catch {}
  try { socket.ws?.close?.() } catch {}
  try { socket.end?.(new Error('Reinicio de conexión')) } catch {}
}

function scheduleReconnect(reason = 'desconocido', delay = null) {
  // Si ya hay una reconexión programada, no creemos otro timer.
  if (reconnectTimer) return

  reconnectPending = true
  reconnectAttempt++

  const wait = delay ?? Math.min(30000, 3000 * Math.min(reconnectAttempt, 5))
  console.warn(chalk.yellow(`🔄 Reconexión programada en ${Math.ceil(wait / 1000)}s · motivo: ${reason} · intento ${reconnectAttempt}`))

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    reconnectPending = false
    await restartConnection(reason)
  }, wait)
}

async function createConnection() {
  const previous = conn

  // Invalidamos inmediatamente la conexión anterior para que ningún evento
  // atrasado pueda volver a tocar el socket nuevo.
  connectionGeneration++
  const generation = connectionGeneration

  if (previous) closeSocket(previous)

  conn = global.conn = makeWASocket(connectionOptions)
  conn.__generation = generation
  conn.__createdAt = Date.now()
  lastSocketActivity = Date.now()
  conn.isInit = false
  conn.well = false

  if (!state.creds.registered) {
    let phoneNumber = await question(chalk.blue('Ingresa el número de WhatsApp para vincular el bot (ej. 504XXXXXXXX):\n'))
    phoneNumber = phoneNumber.replace(/\D/g, '')

    if (!phoneNumber) throw new Error('Número de WhatsApp inválido.')

    if (!conn.requestPairingCode) {
      throw new Error('Esta versión de Baileys no soporta código de vinculación.')
    }

    await new Promise(resolve => setTimeout(resolve, 3000))

    try {
      const code = await conn.requestPairingCode(phoneNumber)
      console.log(chalk.magenta(`Código de vinculación: ${String(code).match(/.{1,4}/g)?.join('-') || code}`))
    } catch (error) {
      console.error(chalk.red('❌ No se pudo solicitar el código de vinculación:', error?.message || error))
      scheduleReconnect('fallo solicitando código de vinculación', 5000)
    }
  }

  return conn
}

async function connectionUpdate(update) {
  const { connection, isNewLogin } = update || {}

  lastSocketActivity = Date.now()

  // Ignorar eventos de una conexión antigua después de un reinicio.
  if (this !== conn || this?.__generation !== connectionGeneration) return

  if (isNewLogin) conn.isInit = true

  if (connection === 'open') {
    global.botStartTime = Math.floor(Date.now() / 1000)
    lastSocketActivity = Date.now()
    lastMessageActivity = Date.now()
    reconnectAttempt = 0
    reconnectPending = false
    conn.isInit = true
    console.log(chalk.green('✅ Conectado correctamente.'))
    console.log(chalk.gray(`📡 WebSocket activo · generación ${connectionGeneration}`))
    return
  }

  if (connection !== 'close') return

  const code = getDisconnectCode(update)

  if (code === DisconnectReason?.loggedOut) {
    console.error(chalk.red('❌ Sesión cerrada. No se borrarán las credenciales automáticamente.'))
    return
  }

  console.warn(chalk.yellow(`⚠️ Conexión cerrada${code ? ` (código ${code})` : ''}. Reconectando...`))

  // IMPORTANTE: no esperamos la reconexión dentro del listener de
  // connection.update. Si el socket nuevo se cierra antes de abrirse,
  // su propio evento "close" debe poder programar otra reconexión.
  scheduleReconnect(code ? `código ${code}` : 'conexión cerrada', code === 408 ? 3000 : 5000)
}

async function restartConnection(reason = 'reinicio') {
  if (restarting) {
    reconnectPending = true
    return
  }

  restarting = true

  try {
    console.log(chalk.gray(`🔁 Iniciando reconexión · ${reason}`))

    // Si quedó un socket anterior, ciérralo antes de crear el nuevo.
    closeSocket(conn)

    const newConn = await createConnection()

    // Es fundamental instalar los listeners inmediatamente en el socket nuevo.
    // Así, si WhatsApp devuelve otro 408 antes de abrir, no se pierde el evento.
    if (newConn === conn) {
      await attachHandlers()
    }

    lastSocketActivity = Date.now()
    lastMessageActivity = Date.now()
  } catch (error) {
    console.error('[RESTART]', error?.stack || error)
    scheduleReconnect('error creando conexión', 5000)
  } finally {
    restarting = false
  }

  // Si durante la reconexión llegó otro close, aseguramos que haya otro intento.
  if (reconnectPending && !reconnectTimer && conn) {
    scheduleReconnect('reconexión pendiente', 3000)
  }
}

async function attachHandlers() {
  if (!handler) handler = await import('./handler.js')

  try {
    if (conn.__handlersAttached) return
  } catch {}

  const currentConn = conn
  const currentGeneration = connectionGeneration

  currentConn.handler = async update => {
    if (
      currentConn !== conn ||
      currentGeneration !== connectionGeneration
    ) return

    lastMessageActivity = Date.now()
    lastSocketActivity = Date.now()

    try {
      await handler.handler.call(currentConn, update)
    } catch (error) {
      console.error(
        chalk.red('❌ Error procesando messages.upsert:'),
        error?.stack || error
      )
    }
  }

  currentConn.connectionUpdate = connectionUpdate.bind(currentConn)
  currentConn.credsUpdate = saveCreds

  currentConn.ev.on('messages.upsert', currentConn.handler)
  currentConn.ev.on('connection.update', currentConn.connectionUpdate)
  currentConn.ev.on('creds.update', currentConn.credsUpdate)

  currentConn.ev.on('groups.update', updates => {
    try {
      for (const update of Array.isArray(updates) ? updates : []) {
        if (update?.id) global.groupMetadataCache?.del(update.id)
      }
    } catch {}
  })

  currentConn.ev.on('group-participants.update', update => {
    try {
      if (update?.id) global.groupMetadataCache?.del(update.id)
    } catch {}
  })

  currentConn.__handlersAttached = true
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
    scheduleReconnect('reloadHandler', 1000)
    return true
  }

  if (conn && isInit) {
    try { conn.ev.off('messages.upsert', conn.handler) } catch {}
    try { conn.ev.off('connection.update', conn.connectionUpdate) } catch {}
    try { conn.ev.off('creds.update', conn.credsUpdate) } catch {}
    try { conn.ev.removeAllListeners('groups.update') } catch {}
    try { conn.ev.removeAllListeners('group-participants.update') } catch {}
    conn.__handlersAttached = false
    await attachHandlers()
  }

  return true
}

// Watchdog: si el WebSocket se cierra sin que el evento de Baileys consiga
// recuperarlo, programamos una reconexión. También hacemos una comprobación
// periódica de actividad para detectar sockets zombis.
watchdogTimer = setInterval(() => {
  if (restarting || !conn) return

  const ws = conn.ws
  const readyState = ws?.readyState

  if (ws && typeof readyState === 'number' && readyState !== 1) {
    console.warn(chalk.yellow(`⚠️ Watchdog: WebSocket no está abierto (estado ${readyState}). Reconectando...`))
    scheduleReconnect(`watchdog estado ${readyState}`, 2000)
    return
  }

  if (
    ws &&
    typeof readyState === 'number' &&
    readyState === 1 &&
    Date.now() - lastSocketActivity > 10 * 60 * 1000
  ) {
    console.log(chalk.gray('🩺 Watchdog: 10 min sin eventos; comprobando conexión...'))

    try {
      const result = conn.sendPresenceUpdate?.('available')
      if (result?.catch) {
        result.catch(error => {
          console.warn(chalk.yellow('⚠️ Watchdog: el socket no respondió. Reconectando...'))
          scheduleReconnect(`watchdog sin respuesta: ${error?.message || error}`, 2000)
        })
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Watchdog: error comprobando socket. Reconectando...'))
      scheduleReconnect(`watchdog: ${error?.message || error}`, 2000)
    }

    lastSocketActivity = Date.now()
  }
}, 60 * 1000)

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
