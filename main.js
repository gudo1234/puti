
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '1'

import './config.js'
import { createRequire } from 'module'
import path, { join } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import { readdirSync, statSync, unlinkSync, existsSync, readFileSync, mkdirSync, watch } from 'fs'
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

if (typeof makeWASocket !== 'function') {
  throw new Error('ZEUSBOT6: ./lib/simple.js no exporta makeWASocket como función.')
}
if (typeof useMultiFileAuthState !== 'function') {
  throw new Error('ZEUSBOT6: la versión instalada de Baileys no exporta useMultiFileAuthState().')
}
if (typeof makeCacheableSignalKeyStore !== 'function') {
  throw new Error('ZEUSBOT6: la versión instalada de Baileys no exporta makeCacheableSignalKeyStore().')
}

const { chain } = lodash

protoType()
serialize()

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix
    ? (/file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL)
    : pathToFileURL(pathURL).toString()
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

global.prefix = new RegExp(
  '^[' + String(prefixValue).replace(/[|\\{}()[\]^$+*?.\-\^]/g, '\\$&') + ']'
)

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
    if (error?.code !== 'ENOENT') {
      console.error('[DB] Error leyendo database.json:', error?.message || error)
    }
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
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  })
  rl.question(text, answer => {
    rl.close()
    resolve(answer)
  })
})

const { state, saveCreds } = await useMultiFileAuthState(sessionsDir)

const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0, useClones: false })
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0, useClones: false })
const mediaCache = new NodeCache({ stdTTL: 0, checkperiod: 0, useClones: false })

global.groupMetadataCache = new NodeCache({
  stdTTL: 60,
  checkperiod: 30,
  useClones: false
})

global.cachedGroupMetadata = async function (jid) {
  if (!jid?.endsWith('@g.us')) return {}

  const cached = global.groupMetadataCache.get(jid)
  if (cached) return cached

  try {
    if (!global.conn) return {}
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
  browser: ['ZEUSBOT6', 'Chrome', '120.0.0'],
  cachedGroupMetadata: global.cachedGroupMetadata
}

let conn = null
let handler = null
let isInit = false
let restarting = false
let reconnectTimer = null
let reconnectAttempt = 0
let reconnectPending = false
let connectionGeneration = 0
let lastSocketActivity = Date.now()
let lastMessageActivity = Date.now()
let pairingPhoneNumber = ''
let pairingInProgress = false
let pairingRequestedForGeneration = 0
let pairingFailed = false
let initialSetupComplete = false

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

  try {
    socket.ev?.removeAllListeners?.()
  } catch {}

  try {
    socket.ws?.close?.()
  } catch {}

  try {
    socket.end?.(new Error('ZEUSBOT6: cierre controlado del socket'))
  } catch {}
}

function scheduleReconnect(reason = 'desconocido', delay = null) {
  // No reconectar mientras la cuenta todavía no esté vinculada.
  if (!state.creds.registered) {
    console.warn(
      chalk.yellow('⏸️ ZEUSBOT6: reconexión pausada porque la cuenta todavía no está vinculada.')
    )
    return
  }

  if (reconnectTimer || restarting) {
    reconnectPending = true
    return
  }

  reconnectAttempt++

  const wait = delay ?? Math.min(
    5000 * (2 ** Math.min(reconnectAttempt - 1, 5)),
    120000
  )

  console.warn(
    chalk.yellow(
      `🔄 Reconexión en ${Math.ceil(wait / 1000)} s · motivo: ${reason} · intento ${reconnectAttempt}`
    )
  )

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    reconnectPending = false
    await restartConnection(reason)
  }, wait)
}

async function requestPairingCodeForCurrentSocket(socket, generation) {
  if (state.creds.registered || pairingInProgress || pairingFailed) return
  if (pairingRequestedForGeneration === generation) return

  pairingInProgress = true
  pairingRequestedForGeneration = generation

  try {
    if (!pairingPhoneNumber) {
      const entered = await question(
        chalk.blue('ZEUSBOT6 · Ingresa el número de WhatsApp con código de país (ej. 504XXXXXXXX):\n')
      )

      pairingPhoneNumber = entered.replace(/\D/g, '')

      if (!pairingPhoneNumber || pairingPhoneNumber.length < 8) {
        pairingRequestedForGeneration = 0
        throw new Error('Número inválido. Introduce el número completo con código de país, solo dígitos.')
      }
    }

    // Dar tiempo a Baileys para inicializar el WebSocket.
    await new Promise(resolve => setTimeout(resolve, 3000))

    if (socket !== conn || generation !== connectionGeneration) return
    if (state.creds.registered) return

    const readyState = socket.ws?.readyState

    if (typeof readyState === 'number' && readyState !== 0 && readyState !== 1) {
      throw new Error(`El WebSocket ya está cerrado (estado ${readyState}). No se solicitará el código en un socket cerrado.`)
    }

    if (typeof socket.requestPairingCode !== 'function') {
      throw new Error('La versión instalada de Baileys no ofrece requestPairingCode(). Actualiza o revisa @whiskeysockets/baileys.')
    }

    console.log(chalk.gray('🔐 Solicitando código de vinculación a WhatsApp...'))

    const code = await socket.requestPairingCode(pairingPhoneNumber)

    if (socket !== conn || generation !== connectionGeneration) return

    if (!code) {
      throw new Error('Baileys no devolvió un código de vinculación.')
    }

    console.log(
      chalk.magenta(
        `🔑 Código de vinculación ZEUSBOT6: ${String(code).match(/.{1,4}/g)?.join('-') || code}`
      )
    )

    console.log(chalk.cyan('📱 En WhatsApp: Dispositivos vinculados → Vincular dispositivo → Vincular con número de teléfono.'))
    console.log(chalk.gray('⏸️ La reconexión automática permanecerá pausada mientras completas la vinculación.'))
  } catch (error) {
    pairingFailed = true

    console.error(
      chalk.red('❌ No se pudo solicitar el código de vinculación:'),
      error?.stack || error?.message || error
    )

    console.error(
      chalk.yellow('⏸️ No se reconectará automáticamente durante la vinculación. Revisa el error anterior y reinicia manualmente cuando lo hayas corregido.')
    )
  } finally {
    pairingInProgress = false
  }
}

async function createConnection() {
  const previous = conn
  connectionGeneration++
  const generation = connectionGeneration

  if (previous) closeSocket(previous)

  const socket = makeWASocket(connectionOptions)
  conn = global.conn = socket

  socket.__generation = generation
  socket.__createdAt = Date.now()
  socket.isInit = false
  socket.well = false

  lastSocketActivity = Date.now()
  return socket
}

async function connectionUpdate(update) {
  const { connection, isNewLogin } = update || {}
  lastSocketActivity = Date.now()

  if (this !== conn || this?.__generation !== connectionGeneration) return

  if (isNewLogin) conn.isInit = true

  if (connection === 'open') {
    global.botStartTime = Math.floor(Date.now() / 1000)
    lastSocketActivity = Date.now()
    lastMessageActivity = Date.now()
    reconnectAttempt = 0
    reconnectPending = false
    pairingFailed = false

    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }

    conn.isInit = true
    console.log(chalk.green('✅ ZEUSBOT6 conectado correctamente.'))
    console.log(chalk.gray(`📡 WebSocket activo · generación ${connectionGeneration}`))
    return
  }

  if (connection !== 'close') return

  const code = getDisconnectCode(update)

  // No reiniciar ni solicitar otro código automáticamente durante la vinculación.
  if (!state.creds.registered) {
    console.error(
      chalk.red(`❌ Conexión cerrada durante la vinculación (código ${code ?? 'desconocido'}).`)
    )

    console.error(
      chalk.yellow('⏸️ ZEUSBOT6 queda en pausa. No se intentará reconectar ni pedir otro código automáticamente.')
    )
    return
  }

  if (code === DisconnectReason?.loggedOut) {
    console.error(
      chalk.red('❌ Sesión cerrada por WhatsApp. No se borrarán las credenciales automáticamente.')
    )
    return
  }

  console.warn(
    chalk.yellow(
      `⚠️ Conexión cerrada${code ? ` (código ${code})` : ''}. Se reintentará con espera progresiva.`
    )
  )

  scheduleReconnect(code ? `código ${code}` : 'conexión cerrada')
}

async function restartConnection(reason = 'reinicio') {
  if (!state.creds.registered) {
    console.warn(chalk.yellow('⏸️ Reconexión cancelada: ZEUSBOT6 aún no está vinculado.'))
    return
  }

  if (restarting) {
    reconnectPending = true
    return
  }

  restarting = true

  try {
    console.log(chalk.gray(`🔁 Reiniciando conexión ZEUSBOT6 · ${reason}`))

    const newConn = await createConnection()
    await attachHandlers()

    lastSocketActivity = Date.now()
    lastMessageActivity = Date.now()

    if (!state.creds.registered) {
      console.warn(chalk.yellow('⏸️ Se pausó la reconexión porque la sesión ya no figura como vinculada.'))
    }
  } catch (error) {
    console.error('[ZEUSBOT6:RESTART]', error?.stack || error)
    reconnectPending = false
    scheduleReconnect('error creando conexión')
  } finally {
    restarting = false
  }

  if (reconnectPending && !reconnectTimer && state.creds.registered) {
    reconnectPending = false
    scheduleReconnect('reconexión pendiente')
  }
}

async function attachHandlers() {
  if (!handler) handler = await import('./handler.js')
  if (!conn || conn.__handlersAttached) return

  const currentConn = conn
  const currentGeneration = connectionGeneration

  currentConn.handler = async update => {
    if (currentConn !== conn || currentGeneration !== connectionGeneration) return

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
    console.error('[HANDLER] No se pudo recargar:', error?.stack || error)
    return false
  }

  if (restart) {
    scheduleReconnect('reloadHandler')
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

setInterval(() => {
  if (restarting || !conn) return

  // El watchdog no debe interferir con la vinculación.
  if (!state.creds.registered) return

  const ws = conn.ws
  const readyState = ws?.readyState

  if (typeof readyState === 'number' && readyState !== 1 && readyState !== 0) {
    console.warn(chalk.yellow(`⚠️ Watchdog: WebSocket cerrado (estado ${readyState}).`))
    scheduleReconnect(`watchdog estado ${readyState}`)
    return
  }

  if (
    readyState === 1 &&
    Date.now() - lastSocketActivity > 10 * 60 * 1000
  ) {
    console.log(chalk.gray('🩺 Watchdog: 10 min sin eventos; comprobando conexión...'))

    try {
      const result = conn.sendPresenceUpdate?.('available')

      if (result?.catch) {
        result.catch(error => {
          console.warn(chalk.yellow('⚠️ Watchdog: el socket no respondió.'))
          scheduleReconnect(`watchdog sin respuesta: ${error?.message || error}`)
        })
      }
    } catch (error) {
      console.warn(chalk.yellow('⚠️ Watchdog: error comprobando socket.'))
      scheduleReconnect(`watchdog: ${error?.message || error}`)
    }

    lastSocketActivity = Date.now()
  }
}, 60000)

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
  if (!existsSync(pluginFolder)) {
    mkdirSync(pluginFolder, { recursive: true })
  }

  const files = readdirSync(pluginFolder).filter(pluginFilter).sort()
  for (const filename of files) await loadPlugin(filename)

  console.log(
    chalk.cyan(`📦 ZEUSBOT6 · Plugins cargados: ${Object.keys(global.plugins).length}/${files.length}`)
  )
}

await filesInit()

global.reload = async (_event, filename) => {
  if (!filename || !pluginFilter(filename)) return
  await loadPlugin(filename)
}
Object.freeze(global.reload)

try {
  watch(pluginFolder, global.reload)
} catch (error) {
  console.error('[PLUGINS] No se pudo activar el watcher:', error?.stack || error)
}

global.dbDirty = false

if (!global.opts.test) {
  setInterval(async () => {
    if (!global.dbDirty || !global.db.data) return

    try {
      await global.db.write()
      global.dbDirty = false
    } catch (error) {
      console.error('[DB] Error guardando:', error?.stack || error)
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
        if (stats.isFile() && Date.now() - stats.mtimeMs >= 60000) {
          unlinkSync(full)
        }
      } catch {}
    }
  }
}

setInterval(() => {
  clearTmp().catch(error => console.error('[TMP]', error?.message || error))
}, 5 * 60 * 1000)

process.on('uncaughtException', error => {
  console.error('❌ uncaughtException:', error?.stack || error)
})

process.on('unhandledRejection', error => {
  console.error('❌ unhandledRejection:', error?.stack || error)
})

const initialConn = await createConnection()
await attachHandlers()

if (!state.creds.registered) {
  // El código se solicita una sola vez. Si falla, no hay bucle de reconexiones.
  void requestPairingCodeForCurrentSocket(initialConn, initialConn.__generation)
} else {
  initialSetupComplete = true
}

console.log(chalk.green('🚀 ZEUSBOT6 iniciado.'))
