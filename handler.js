import { smsg } from './lib/simple.js'
import print from './lib/print.js'
import { format } from 'util'
import { fileURLToPath } from 'url'
import path, { join } from 'path'
import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'

const delay = ms => new Promise(res => setTimeout(res, ms))

if (!global.db) {
  global.db = {
    data: {
      users: {},
      chats: {},
      settings: {}
    },
    write: async () => {},
    read: async () => {},
    READ: false
  }
}

global.dbDirty = false
global.botStartTime ||= Math.floor(Date.now() / 1000)

function getUser(id) {
  const u = global.db.data.users[id] ||= {
    exp: 0,
    limit: 10,
    registered: false,
    name: '',
    age: -1,
    regTime: -1,
    afk: -1,
    afkReason: '',
    banned: false,
    useDocument: false,
    bank: 0,
    level: 0,
    premium: false,
    premiumTime: 0
  }

  global.dbDirty = true
  return u
}

function getChat(id) {
  const c = global.db.data.chats[id] ||= {
    isBanned: false,
    bienvenida: true,
    welcome: true,
    detect: true,
    antiLink: false,
    antifake: false,
    nsfw: true,
    expired: 0,
    autosticker: true,
    autoband: true
  }

  if (c.welcome == null) c.welcome = true
  if (c.detect == null) c.detect = true

  global.dbDirty = true
  return c
}

function getSettings(jid) {
  const s = global.db.data.settings[jid] ||= {
    self: false,
    autoread: false,
    status: 0
  }

  global.dbDirty = true
  return s
}

function extractText(m) {
  const msg = m.message || {}

  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.templateButtonReplyMessage?.selectedId ||
    (() => {
      try {
        const p =
          msg.interactiveResponseMessage
            ?.nativeFlowResponseMessage
            ?.paramsJson

        return p
          ? JSON.parse(p).id || ''
          : ''
      } catch {
        return ''
      }
    })() ||
    ''
  )
}

function detectPrefix(text, prefix) {
  if (!text || typeof text !== 'string') return null

  const str2Regex = s =>
    s.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')

  if (prefix instanceof RegExp) {
    const match = prefix.exec(text)
    return match?.[0]
      ? [match[0], prefix]
      : null
  }

  for (const p of (
    Array.isArray(prefix)
      ? prefix
      : [prefix]
  )) {
    const re =
      typeof p === 'string'
        ? new RegExp('^' + str2Regex(p))
        : p

    const m = re.exec(text)

    if (m) {
      return [m[0], re]
    }
  }

  return null
}

function checkCommand(cmd, command) {
  if (cmd instanceof RegExp) {
    return cmd.test(command)
  }

  if (Array.isArray(cmd)) {
    return cmd.some(c =>
      c instanceof RegExp
        ? c.test(command)
        : c === command
    )
  }

  return typeof cmd === 'string' &&
    cmd === command
}

function normalizeJid(jid) {
  if (!jid || typeof jid !== 'string') {
    return ''
  }

  try {
    return this?.decodeJid
      ? this.decodeJid(jid)
      : jid
  } catch {
    return jid
  }
}

function phoneToJid(value) {
  if (!value || typeof value !== 'string') {
    return ''
  }

  const number = value
    .replace(/\D/g, '')

  return number
    ? `${number}@s.whatsapp.net`
    : ''
}

function getRealNumber(participant) {
  if (!participant) return ''

  const values = [
    participant.phoneNumber,
    participant.jid,
    participant.id
  ]

  for (const value of values) {
    if (!value || typeof value !== 'string') {
      continue
    }

    if (
      value.endsWith('@s.whatsapp.net')
    ) {
      const number = value
        .split('@')[0]
        .replace(/\D/g, '')

      if (number) {
        return number
      }
    }

    if (
      value.startsWith('+') ||
      /^\d+$/.test(value)
    ) {
      const number = value
        .replace(/\D/g, '')

      if (number) {
        return number
      }
    }
  }

  return ''
}

function getParticipantKeys(conn, participant) {
  const keys = new Set()

  if (!participant) {
    return keys
  }

  for (const value of [
    participant.id,
    participant.jid,
    participant.phoneNumber
  ]) {
    if (!value || typeof value !== 'string') {
      continue
    }

    keys.add(value)

    try {
      keys.add(conn.decodeJid(value))
    } catch {}

    const number = value
      .split('@')[0]
      .replace(/\D/g, '')

    if (number) {
      keys.add(`${number}@s.whatsapp.net`)
    }
  }

  return keys
}

export async function handler(chatUpdate) {
  this.msgqueque ||= []

  if (!chatUpdate.messages?.length) {
    return
  }
  const messages = chatUpdate.messages.filter(Boolean)
  if (!messages.length) return

  for (const message of messages) {
    try {
      await processMessage.call(this, message, chatUpdate)
    } catch (error) {
      console.error('[HANDLER] Error procesando mensaje:', error?.stack || error)
    }
  }
}

async function processMessage(m, chatUpdate) {
  this.pushMessage([m]).catch(console.error)

  if (!global.db.data) {
    await global.loadDatabase()
  }

  m = smsg(this, m) || m

  if (!m) return
  try {
    await Promise.race([
      print(m, this),
      new Promise(resolve => setTimeout(resolve, 5000))
    ])
  } catch (error) {
    console.error('[PRINT] Error:', error?.message || error)
  }

  m.exp = 0
  m.limit = false

  const user = getUser(m.sender)
  const chat = getChat(m.chat)
  const settings = getSettings(this.user.jid)

  const ts =
    (m.messageTimestamp || 0) * 1000

  if (
    ts <
    global.botStartTime * 1000
  ) {
    return
  }

  this._messageCache ||= new Set()

  if (
    this._messageCache.has(m.key.id)
  ) {
    return
  }

  this._messageCache.add(m.key.id)

  setTimeout(
    () =>
      this._messageCache.delete(m.key.id),
    30000
  )

  if (
    global.opts?.nyimak ||
    (!m.fromMe && global.opts?.self) ||
    (
      global.opts?.swonly &&
      m.chat !== 'status@broadcast'
    )
  ) {
    return
  }

  if (!m.text) {
    m.text = extractText(m)
  }

  if (m.isBaileys) {
    return
  }

  m.exp += Math.ceil(
    Math.random() * 10
  )

  const pluginDir = path.join(
    path.dirname(
      fileURLToPath(import.meta.url)
    ),
    './plugins'
  )

  const groupMeta =
    m.isGroup
      ? await global.cachedGroupMetadata(
          m.chat
        )
      : {}

  const participants =
    groupMeta?.participants || []

  const participantsMap = new Map()

  for (const participant of participants) {
    const keys =
      getParticipantKeys(
        this,
        participant
      )

    for (const key of keys) {
      participantsMap.set(
        key,
        participant
      )
    }
  }

  let userInGroup =
    participantsMap.get(m.sender)

  if (!userInGroup) {
    try {
      userInGroup =
        participantsMap.get(
          this.decodeJid(m.sender)
        )
    } catch {}
  }

  if (!userInGroup) {
    const senderNumber =
      m.sender
        ?.split('@')[0]
        ?.replace(/\D/g, '')

    if (senderNumber) {
      userInGroup =
        participantsMap.get(
          `${senderNumber}@s.whatsapp.net`
        )
    }
  }

  userInGroup ||= {}

  let botInGroup =
    participantsMap.get(
      this.decodeJid(this.user.jid)
    )

  if (!botInGroup) {
    botInGroup =
      participantsMap.get(
        this.user.jid
      )
  }

  botInGroup ||= {}

  const realUserNumber =
    getRealNumber(userInGroup)

  const resolvedSender =
    realUserNumber
      ? phoneToJid(realUserNumber)
      : (
          userInGroup.jid ||
          userInGroup.id ||
          m.sender
        )

  const normalizedSender =
    this.decodeJid(
      resolvedSender
    )

  const _user =
    getUser(normalizedSender)

  const isRAdmin =
    userInGroup.admin === 'superadmin'

  const isAdmin =
    isRAdmin ||
    userInGroup.admin === 'admin'

  const isBotAdmin =
    botInGroup.admin === 'admin' ||
    botInGroup.admin === 'superadmin'

  const ownerNumbers = [
    ...(Array.isArray(global.owner)
      ? global.owner
      : [])
  ]
    .map(v => {
      if (Array.isArray(v)) {
        return v[0]
      }

      return v
    })
    .map(v =>
      String(v || '')
        .replace(/\D/g, '')
    )
    .filter(Boolean)

  const botNumbers = [
    this.user?.id,
    this.user?.jid
  ]
    .map(v =>
      String(v || '')
        .split('@')[0]
        .replace(/\D/g, '')
    )
    .filter(Boolean)

  const senderNumbers = [
    realUserNumber,
    m.sender
      ?.split('@')[0]
      ?.replace(/\D/g, '')
  ]
    .filter(Boolean)

  const isROwner =
    senderNumbers.some(number =>
      ownerNumbers.includes(number) ||
      botNumbers.includes(number)
    )

  const isOwner =
    isROwner ||
    m.fromMe

  const modNumbers = [
    ...(Array.isArray(global.mods)
      ? global.mods
      : [])
  ]
    .map(v =>
      String(v || '')
        .replace(/\D/g, '')
    )
    .filter(Boolean)

  const isMods =
    isOwner ||
    senderNumbers.some(number =>
      modNumbers.includes(number)
    )

  const premiumNumbers = [
    ...(Array.isArray(global.prems)
      ? global.prems
      : [])
  ]
    .map(v =>
      String(v || '')
        .replace(/\D/g, '')
    )
    .filter(Boolean)

  const isPrems =
    isROwner ||
    senderNumbers.some(number =>
      premiumNumbers.includes(number)
    ) ||
    _user.premium

  if (
    global.opts?.queque &&
    m.text &&
    !(isMods || isPrems)
  ) {
    const queue = this.msgqueque
    const prev = queue.at(-1)

    queue.push(
      m.id || m.key.id
    )

    setInterval(
      async function () {
        if (!queue.includes(prev)) {
          clearInterval(this)
        }

        await delay(5000)
      },
      5000
    )
  }

  for (
    const name of Object.keys(
      global.plugins
    )
  ) {
    const plugin =
      global.plugins[name]

    if (
      !plugin ||
      plugin.disabled
    ) {
      continue
    }

    if (
      plugin.group ||
      plugin.admin ||
      plugin.botAdmin
    ) {
      m.isGroup && true
    }

    const baseContext = {
      conn: this,
      participants,
      groupMetadata: groupMeta,

      isROwner,
      isOwner,
      isRAdmin,
      isAdmin,
      isBotAdmin,
      isPrems,

      realUserNumber,
      resolvedSender,
      userInGroup,

      chatUpdate,

      __dirname: pluginDir,

      __filename:
        join(
          pluginDir,
          name
        )
    }

    if (
      plugin.before &&
      !plugin.command &&
      !plugin.customPrefix
    ) {
      try {
        await plugin.before.call(
          this,
          m,
          baseContext
        )
      } catch (e) {
        console.error(e)
      }

      continue
    }

    const match =
      detectPrefix(
        m.text,
        plugin.customPrefix ||
        this.prefix ||
        global.prefix
      )

    if (!match) continue

    const [usedPrefix] = match

    const noPref =
      m.text
        .slice(usedPrefix.length)
        .trim()

    const [
      command,
      ...argsArr
    ] =
      noPref.split(/\s+/)

    const text =
      argsArr.join(' ')

    if (
      !checkCommand(
        plugin.command,
        command
      )
    ) {
      continue
    }

    if (
      plugin.before &&
      await plugin.before.call(
        this,
        m,
        {
          match,
          ...baseContext
        }
      )
    ) {
      continue
    }

    if (
      typeof plugin !== 'function'
    ) {
      continue
    }

    m.plugin = name

    if (
      chat.isBanned &&
      name !== 'unbanchat.js'
    ) {
      return
    }

    if (
      user.banned &&
      name !== 'owner-unbanuser.js'
    ) {
      return
    }

    if (
      settings.banned &&
      name !== 'owner-unbanbot.js'
    ) {
      return
    }

    const fail =
      plugin.fail ||
      global.dfail

    if (
      plugin.rowner &&
      !isROwner
    ) {
      return fail(
        'rowner',
        m,
        this
      )
    }

    if (
      plugin.owner &&
      !isOwner
    ) {
      return fail(
        'owner',
        m,
        this
      )
    }

    if (
      plugin.mods &&
      !isMods
    ) {
      return fail(
        'mods',
        m,
        this
      )
    }

    if (
      plugin.premium &&
      !isPrems
    ) {
      return fail(
        'premium',
        m,
        this
      )
    }

    if (
      plugin.group &&
      !m.isGroup
    ) {
      return fail(
        'group',
        m,
        this
      )
    }

    if (
      plugin.botAdmin &&
      !isBotAdmin
    ) {
      return fail(
        'botAdmin',
        m,
        this
      )
    }

    if (
      plugin.admin &&
      !isAdmin
    ) {
      return fail(
        'admin',
        m,
        this
      )
    }

    if (
      plugin.private &&
      m.isGroup
    ) {
      return fail(
        'private',
        m,
        this
      )
    }

    if (
      plugin.register &&
      !_user.registered
    ) {
      return fail(
        'unreg',
        m,
        this
      )
    }

    m.isCommand = true

    m.limit =
      m.limit ||
      plugin.limit ||
      false

    m.exp +=
      'exp' in plugin
        ? parseInt(plugin.exp)
        : 17

    try {
      await plugin.call(
        this,
        m,
        {
          match,
          usedPrefix,
          noPrefix: noPref,
          args: argsArr,
          command,
          text,

          conn: this,

          participants,
          groupMetadata: groupMeta,

          isROwner,
          isOwner,
          isRAdmin,
          isAdmin,
          isBotAdmin,
          isPrems,

          realUserNumber,
          resolvedSender,
          userInGroup,

          chatUpdate,

          __dirname: pluginDir,

          __filename:
            join(
              pluginDir,
              name
            )
        }
      )

      if (
        !isPrems &&
        plugin.limit
      ) {
        this.reply(
          m.chat,
          `Usaste *${plugin.limit}* ⭐`,
          m
        )
      }
    } catch (e) {
      m.error = e

      console.error(e)

      let errText = format(e)

      Object.values(
        global.APIKeys || {}
      ).forEach(k => {
        errText =
          errText.replace(
            new RegExp(k, 'g'),
            '#HIDDEN#'
          )
      })

      this.reply(
        m.chat,
        errText,
        m
      )
    } finally {
      if (plugin.after) {
        await plugin.after
          .call(this, m)
          .catch(console.error)
      }
    }

    break
  }
}

global.dfail = (
  type,
  m,
  conn
) => {
  const msg = {
    rowner:
      'Solo dueño principal.',

    owner:
      'Solo dueños.',

    mods:
      'Solo moderadores.',

    premium:
      'Solo usuarios premium.',

    group:
      null,

    private:
      'Usar en privado.',

    admin:
      'Requiere admin.',

    botAdmin:
      'El bot necesita admin.',

    unreg:
      'Registrarte con /reg nombre.edad.',

    restrict:
      'Comando restringido.'
  }[type]

  if (msg) {
    conn.reply(
      m.chat,
      msg,
      m
    )
  }
}

watchFile(
  global.__filename(
    import.meta.url,
    true
  ),
  async () => {
    unwatchFile(
      global.__filename(
        import.meta.url,
        true
      )
    )

    console.log(
      chalk.magenta(
        'handler.js actualizado'
      )
    )

    if (global.reloadHandler) {
      console.log(
        await global.reloadHandler()
      )
    }
  }
)
