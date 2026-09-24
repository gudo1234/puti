import fs from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import fetch from 'node-fetch'
import path from 'path'
import { sticker } from '../lib/sticker.js'

let handler = async (m, { conn, __dirname }) => {
  const chat = global.db?.data?.chats?.[m.chat] || {}
  const welcomeEnabled = chat.welcome ?? chat.bienvenida

  if (!m.isGroup || !welcomeEnabled) return true
  if (!m.messageStubType || ![27, 28, 32].includes(m.messageStubType)) return

  const isWelcome = m.messageStubType === 27
  const isBye = m.messageStubType === 28 || m.messageStubType === 32

  let userData = m.messageStubParameters?.[0]

  if (!userData) return

  let user = null

  try {
    if (typeof userData === 'string') {
      const value = userData.trim()

      if (value.startsWith('{') && value.endsWith('}')) {
        const parsed = JSON.parse(value)

        user =
          parsed?.phoneNumber ||
          parsed?.jid ||
          parsed?.id ||
          null
      } else {
        user = value
      }
    } else if (typeof userData === 'object') {
      user =
        userData?.phoneNumber ||
        userData?.jid ||
        userData?.id ||
        null
    }
  } catch (e) {
    console.error('[WELCOME] Error leyendo participante:', e)

    if (typeof userData === 'string') {
      user = userData
    }
  }

  if (!user || typeof user !== 'string') {
    console.log('[WELCOME] No se pudo obtener el JID del participante:', userData)
    return
  }

  if (user.endsWith('@lid') && m.isGroup) {
    try {
      const metadata = await conn.groupMetadata(m.chat).catch(() => null)

      const match = metadata?.participants?.find(p =>
        p?.id === user ||
        p?.lid === user ||
        p?.jid === user
      )

      if (match?.jid) {
        user = match.jid
      } else if (match?.phoneNumber) {
        user = match.phoneNumber
      }
    } catch (e) {
      console.log(
        '[WELCOME] No se pudo resolver el LID:',
        e?.message || e
      )
    }
  }

  const channelInfo = global.channelRD || {}
  const wm = global.wm || ''
  const textbot = global.textbot || ''
  const redes = global.redes || ''
  const icono = global.icono || ''

  let name = 'Usuario'

  try {
    const result = await conn.getName(user)

    if (result) {
      name = result
    }
  } catch {
    name = 'Usuario'
  }

  let groupName = ''
  let tantos = 0

  try {
    if (m.isGroup) {
      const metadata = await conn.groupMetadata(m.chat)

      groupName = metadata?.subject || ''
      tantos = metadata?.participants?.length || 0
    }
  } catch {
    groupName = ''
    tantos = 0
  }

  const isConnected = () => {
    try {
      if (!conn) return false

      if (conn.ws && typeof conn.ws.readyState === 'number') {
        return conn.ws.readyState === 1
      }

      return true
    } catch {
      return false
    }
  }

  const waitForConnection = async (
    tries = 8,
    delay = 1500
  ) => {
    for (let i = 0; i < tries; i++) {
      if (isConnected()) {
        return true
      }

      console.log(
        `[WELCOME] Esperando conexión... ${i + 1}/${tries}`
      )

      await new Promise(resolve =>
        setTimeout(resolve, delay)
      )
    }

    return false
  }

  const safeSendMessage = async (
    chatId,
    content,
    options = {},
    retries = 3
  ) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      const connected = await waitForConnection(4, 1000)

      if (!connected) {
        console.log(
          '[WELCOME] WhatsApp continúa desconectado.'
        )

        continue
      }

      try {
        return await conn.sendMessage(
          chatId,
          content,
          options
        )
      } catch (e) {
        const errorText = String(
          e?.message || e || ''
        )

        console.error(
          `[WELCOME] Error de envío (${attempt + 1}/${retries}):`,
          errorText
        )

        if (
          /Connection Closed/i.test(errorText) ||
          /Connection closed/i.test(errorText) ||
          /428/i.test(errorText) ||
          /500/i.test(errorText)
        ) {
          await new Promise(resolve =>
            setTimeout(resolve, 2000)
          )

          continue
        }

        throw e
      }
    }

    console.log(
      '[WELCOME] No se pudo enviar el mensaje después de varios intentos.'
    )

    return null
  }

  let im = null

  try {
    const pp = await conn
      .profilePictureUrl(user, 'image')
      .catch(() => icono || null)

    if (pp) {
      const response = await fetch(pp)

      if (response.ok) {
        im = Buffer.from(
          await response.arrayBuffer()
        )
      }
    }
  } catch {
    im = null
  }

  const uptime = process.uptime() * 1000
  const run = clockString(uptime)

  const imgPath = join(
    __dirname,
    '../storage/catalogo.jpg'
  )

  let thumbResized = null

  try {
    if (fs.existsSync(imgPath)) {
      const thumbLocal = fs.readFileSync(imgPath)

      thumbResized = await sharp(thumbLocal)
        .resize(300, 100, {
          fit: 'cover'
        })
        .jpeg()
        .toBuffer()
    }
  } catch (e) {
    console.error(
      '[WELCOME] Error preparando thumbnail:',
      e?.message || e
    )
  }

  let previewThumbnail = null

  try {
    if (icono) {
      const response = await fetch(icono)

      if (response.ok) {
        const original = Buffer.from(
          await response.arrayBuffer()
        )

        previewThumbnail = await sharp(original)
          .resize(640, 640, {
            fit: 'cover',
            position: 'centre'
          })
          .jpeg({
            quality: 100,
            chromaSubsampling: '4:4:4'
          })
          .toBuffer()
      }
    }
  } catch (e) {
    console.error(
      '[WELCOME] Error preparando preview:',
      e?.message || e
    )

    previewThumbnail = null
  }

  const audiosWelcome = [
    'https://raw.githubusercontent.com/edar123/im/main/media/a.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/bien.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/prueba3.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/prueba4.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/bloody.mp3'
  ]

  const audiosBye = [
    'https://raw.githubusercontent.com/edar123/im/main/media/adios.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/prueba.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/sad.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/cardigansad.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/iwas.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/juntos.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/space.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/stellar.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/theb.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/alanspectre.mp3'
  ]

  const audioPick = arr =>
    arr[Math.floor(Math.random() * arr.length)]

  const gifsBienvenida = [
    'https://raw.githubusercontent.com/edar123/im/main/media/gif.mp4',
    'https://raw.githubusercontent.com/edar123/im/main/media/giff.mp4',
    'https://raw.githubusercontent.com/edar123/im/main/media/gifff.mp4',
    'https://raw.githubusercontent.com/edar123/im/main/media/gif4.mp4'
  ]

  const gifDespedida =
    'https://qu.ax/xOtQJ.mp4'

  const formatos = [
    'stiker',
    'audio',
    'texto',
    'gifPlayback',
    'interactivo'
  ]

  const formatoElegido =
    formatos[
      Math.floor(
        Math.random() * formatos.length
      )
    ]

  const actividad = isWelcome
    ? `${global.e || ''} Bienvenid@, @${user.split('@')[0]}`
    : `👋🏻 Adiós, @${user.split('@')[0]}`

  const ac = isWelcome
    ? `${global.e || ''} Bienvenid@, ${name}`
    : `👋🏻 Adiós, ${name}`

  const newsletterInfo = channelInfo?.id
    ? {
        forwardedNewsletterMessageInfo: {
          newsletterJid: channelInfo.id,
          newsletterName:
            channelInfo.name || '',
          serverMessageId: 0
        }
      }
    : {}

  const createContextInfo = ({
    title = textbot,
    body = wm,
    mentioned = true,
    forwardingScore = 10,
    isForwarded = true
  } = {}) => {
    const externalAdReply = {
      showAdAttribution: false,
      title,
      body,
      mediaType: 1,
      renderLargerThumbnail: false
    }

    if (redes) {
      externalAdReply.sourceUrl = redes
      externalAdReply.thumbnailUrl = redes
    }

    if (Buffer.isBuffer(previewThumbnail)) {
      externalAdReply.thumbnail = previewThumbnail
    } else if (Buffer.isBuffer(im)) {
      externalAdReply.thumbnail = im
    }

    return {
      ...newsletterInfo,
      ...(mentioned ? { mentionedJid: [user] } : {}),
      forwardingScore,
      isForwarded,
      externalAdReply
    }
  }

  const createNormalContextInfo = ({
    mentioned = true,
    forwardingScore = 10,
    isForwarded = true
  } = {}) => {
    return {
      ...newsletterInfo,
      ...(mentioned ? { mentionedJid: [user] } : {}),
      forwardingScore,
      isForwarded
    }
  }

  try {
    if (formatoElegido === 'stiker') {
      const stickerSource = await fetch(
        isWelcome
          ? gifsBienvenida[
              Math.floor(
                Math.random() * gifsBienvenida.length
              )
            ]
          : gifDespedida
      )

      if (!stickerSource.ok) {
        throw new Error('No se pudo obtener el sticker')
      }

      const videoBuffer = Buffer.from(
        await stickerSource.arrayBuffer()
      )

      const stickerBuffer = await sticker(
        videoBuffer,
        false,
        {
          pack: textbot,
          author: wm
        }
      )

      await safeSendMessage(
        m.chat,
        {
          sticker: stickerBuffer,
          contextInfo: createContextInfo()
        },
        {
          quoted: m
        }
      )

      return
    }

    if (formatoElegido === 'audio') {
      const audioUrl = audioPick(
        isWelcome
          ? audiosWelcome
          : audiosBye
      )

      await safeSendMessage(
        m.chat,
        {
          audio: {
            url: audioUrl
          },
          mimetype: 'audio/mpeg',
          ptt: false,
          contextInfo: createContextInfo()
        },
        {
          quoted: m
        }
      )

      return
    }

    if (formatoElegido === 'gifPlayback') {
      const gifUrl = isWelcome
        ? gifsBienvenida[
            Math.floor(
              Math.random() * gifsBienvenida.length
            )
          ]
        : gifDespedida

      await safeSendMessage(
        m.chat,
        {
          video: {
            url: gifUrl
          },
          gifPlayback: true,
          caption: actividad,
          contextInfo: createContextInfo()
        },
        {
          quoted: m
        }
      )

      return
    }

    if (formatoElegido === 'texto') {
      await safeSendMessage(
        m.chat,
        {
          text: actividad,
          contextInfo: createNormalContextInfo()
        },
        {
          quoted: m
        }
      )

      return
    }

    if (formatoElegido === 'interactivo') {
      const documentMessage = {
        document: {
          url: imgPath
        },
        mimetype: 'application/pdf',
        fileName: `${textbot}.pdf`,
        fileLength: 999999,
        caption: ac
      }

      await safeSendMessage(
        m.chat,
        documentMessage,
        {
          quoted: m
        }
      )

      return
    }
  } catch (e) {
    console.error(
      '[WELCOME] Error enviando bienvenida/despedida:',
      e?.message || e
    )
  }
}

function clockString(ms) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor(
    (ms % 3600000) / 60000
  )
  const s = Math.floor(
    (ms % 60000) / 1000
  )

  return [
    h,
    m,
    s
  ]
    .map(v =>
      v.toString().padStart(2, '0')
    )
    .join(':')
}

export default handler
