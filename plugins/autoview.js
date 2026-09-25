import PhoneNumber from "awesome-phonenumber"
import {
  downloadContentFromMessage
} from "@whiskeysockets/baileys"

const WATCH_GROUPS = new Set([])

const NOTIFY_JIDS = [
  "120363407073055516@g.us"
]

const SEND_VIEWONCE_CONTENT = true

const SEEN_TTL_MS = 10 * 60 * 1000
const SEEN_LIMIT = 250

const seen = new Map()

function cleanupSeen() {
  const now = Date.now()

  for (const [key, time] of seen) {
    if (now - time > SEEN_TTL_MS) {
      seen.delete(key)
    }
  }

  while (seen.size > SEEN_LIMIT) {
    seen.delete(seen.keys().next().value)
  }
}

function alreadySeen(id) {
  cleanupSeen()

  if (!id) return false

  if (seen.has(id)) {
    return true
  }

  seen.set(id, Date.now())
  return false
}

function unwrapMessage(message) {
  if (!message || typeof message !== "object") {
    return null
  }

  let current = message

  for (let i = 0; i < 15; i++) {
    if (!current || typeof current !== "object") {
      return null
    }

    if (
      current.viewOnceMessage?.message
    ) {
      current = current.viewOnceMessage.message
      continue
    }

    if (
      current.viewOnceMessageV2?.message
    ) {
      current = current.viewOnceMessageV2.message
      continue
    }

    if (
      current.viewOnceMessageV2Extension?.message
    ) {
      current = current.viewOnceMessageV2Extension.message
      continue
    }

    if (
      current.ephemeralMessage?.message
    ) {
      current = current.ephemeralMessage.message
      continue
    }

    if (
      current.documentWithCaptionMessage?.message
    ) {
      current = current.documentWithCaptionMessage.message
      continue
    }

    if (
      current.editedMessage?.message
    ) {
      current = current.editedMessage.message
      continue
    }

    if (
      current.deviceSentMessage?.message
    ) {
      current = current.deviceSentMessage.message
      continue
    }

    if (
      current.futureproofMessage?.message
    ) {
      current = current.futureproofMessage.message
      continue
    }

    break
  }

  return current
}

function findViewOnce(message) {
  if (!message || typeof message !== "object") {
    return null
  }

  if (message.viewOnceMessage?.message) {
    return {
      message: message.viewOnceMessage.message,
      wrapper: "viewOnceMessage"
    }
  }

  if (message.viewOnceMessageV2?.message) {
    return {
      message: message.viewOnceMessageV2.message,
      wrapper: "viewOnceMessageV2"
    }
  }

  if (message.viewOnceMessageV2Extension?.message) {
    return {
      message: message.viewOnceMessageV2Extension.message,
      wrapper: "viewOnceMessageV2Extension"
    }
  }

  if (message.imageMessage?.viewOnce) {
    return {
      message,
      wrapper: "imageMessage"
    }
  }

  if (message.videoMessage?.viewOnce) {
    return {
      message,
      wrapper: "videoMessage"
    }
  }

  if (message.documentMessage?.viewOnce) {
    return {
      message,
      wrapper: "documentMessage"
    }
  }

  if (message.ephemeralMessage?.message) {
    const result = findViewOnce(message.ephemeralMessage.message)

    if (result) {
      return result
    }
  }

  if (message.documentWithCaptionMessage?.message) {
    const result = findViewOnce(
      message.documentWithCaptionMessage.message
    )

    if (result) {
      return result
    }
  }

  if (message.editedMessage?.message) {
    const result = findViewOnce(
      message.editedMessage.message
    )

    if (result) {
      return result
    }
  }

  if (message.deviceSentMessage?.message) {
    const result = findViewOnce(
      message.deviceSentMessage.message
    )

    if (result) {
      return result
    }
  }

  if (message.futureproofMessage?.message) {
    const result = findViewOnce(
      message.futureproofMessage.message
    )

    if (result) {
      return result
    }
  }

  return null
}

function getViewOnceFromMessage(m) {
  const candidates = []

  if (m?.message) {
    candidates.push(m.message)
  }

  if (m?.msg) {
    candidates.push(m.msg)
  }

  if (m?.message?.ephemeralMessage?.message) {
    candidates.push(
      m.message.ephemeralMessage.message
    )
  }

  if (m?.msg?.ephemeralMessage?.message) {
    candidates.push(
      m.msg.ephemeralMessage.message
    )
  }

  for (const candidate of candidates) {
    const found = findViewOnce(candidate)

    if (found) {
      return found
    }
  }

  if (
    m?.key?.isViewOnce &&
    m?.message
  ) {
    return {
      message: m.message,
      wrapper: "key.isViewOnce"
    }
  }

  return null
}

function getQuotedMessage(m) {
  if (!m) return null

  if (m.quoted?.message) {
    return m.quoted.message
  }

  if (m.quoted?.msg) {
    return m.quoted.msg
  }

  if (m.msg?.contextInfo?.quotedMessage) {
    return m.msg.contextInfo.quotedMessage
  }

  if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
    return m.message.extendedTextMessage.contextInfo.quotedMessage
  }

  if (m.message?.imageMessage?.contextInfo?.quotedMessage) {
    return m.message.imageMessage.contextInfo.quotedMessage
  }

  if (m.message?.videoMessage?.contextInfo?.quotedMessage) {
    return m.message.videoMessage.contextInfo.quotedMessage
  }

  return null
}

function getQuotedViewOnce(m) {
  const quoted = getQuotedMessage(m)

  if (!quoted) {
    return null
  }

  const found = findViewOnce(quoted)

  if (found) {
    return found
  }

  if (m?.quoted?.vM) {
    const vM = findViewOnce(m.quoted.vM)

    if (vM) {
      return vM
    }
  }

  if (
    m?.quoted?.msg &&
    m?.quoted?.mtype
  ) {
    const reconstructed = {
      [m.quoted.mtype]: m.quoted.msg
    }

    const result = findViewOnce(reconstructed)

    if (result) {
      return result
    }

    if (
      m.quoted.msg?.viewOnce
    ) {
      return {
        message: reconstructed,
        wrapper: m.quoted.mtype
      }
    }
  }

  return null
}

function getMediaType(message) {
  if (!message) return null

  if (message.imageMessage) {
    return "image"
  }

  if (message.videoMessage) {
    return "video"
  }

  if (message.documentMessage) {
    return "document"
  }

  return null
}

function getMediaMessage(message) {
  if (!message) return null

  return (
    message.imageMessage ||
    message.videoMessage ||
    message.documentMessage ||
    null
  )
}

function getCaption(message) {
  if (!message) return ""

  return (
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    ""
  )
}

function getSender(m) {
  return (
    m?.sender ||
    m?.key?.participant ||
    m?.participant ||
    m?.key?.remoteJid ||
    ""
  )
}

function cleanJid(jid = "") {
  return jid
    .replace(/:\d+(?=@)/, "")
}

function getPhone(jid = "") {
  const clean = cleanJid(jid)

  const number = clean.split("@")[0]

  return number.replace(/\D/g, "")
}

function getCountryCode(jid = "") {
  try {
    const phone = getPhone(jid)

    if (!phone) {
      return null
    }

    const parsed = new PhoneNumber("+" + phone)

    return parsed.getRegionCode()
  } catch {
    return null
  }
}

function banderaEmoji(region) {
  if (!region || region.length !== 2) {
    return "🌐"
  }

  return [...region.toUpperCase()]
    .map(char =>
      String.fromCodePoint(
        127397 + char.charCodeAt(0)
      )
    )
    .join("")
}

function getParticipantName(m) {
  return (
    m?.pushName ||
    m?.name ||
    m?.senderName ||
    "Desconocido"
  )
}

async function downloadMedia(conn, message, type) {
  if (!message || !type) {
    return null
  }

  try {
    if (typeof conn.downloadContentFromMessage === "function") {
      const stream = await conn.downloadContentFromMessage(
        message,
        type
      )

      const chunks = []

      for await (const chunk of stream) {
        chunks.push(chunk)
      }

      return Buffer.concat(chunks)
    }
  } catch (e) {
    console.error(
      "Error downloadContentFromMessage:",
      e
    )
  }

  try {
    const stream = await downloadContentFromMessage(
      message,
      type
    )

    const chunks = []

    for await (const chunk of stream) {
      chunks.push(chunk)
    }

    return Buffer.concat(chunks)
  } catch (e) {
    console.error(
      "Error downloadContentFromMessage Baileys:",
      e
    )
  }

  return null
}

async function tryDownload(conn, message, type) {
  try {
    if (
      typeof conn.downloadMediaMessage === "function"
    ) {
      const fakeMessage = {
        message
      }

      const buffer = await conn.downloadMediaMessage(
        fakeMessage
      )

      if (buffer) {
        return buffer
      }
    }
  } catch (e) {
    console.error(
      "Error downloadMediaMessage:",
      e
    )
  }

  return downloadMedia(
    conn,
    getMediaMessage(message),
    type
  )
}

async function forwardViewOnce(
  conn,
  m,
  targetJid,
  sourceMessage
) {
  if (
    !sourceMessage ||
    !targetJid
  ) {
    return false
  }

  try {
    if (
      typeof conn.copyNForward === "function"
    ) {
      await conn.copyNForward(
        targetJid,
        {
          key: m.key,
          message: sourceMessage
        },
        true,
        {
          readViewOnce: true
        }
      )

      return true
    }
  } catch (e) {
    console.error(
      "Error copyNForward:",
      e
    )
  }

  return false
}

async function sendViewOnceContent(
  conn,
  targetJid,
  media,
  type,
  caption = ""
) {
  if (!media || !targetJid) {
    return false
  }

  try {
    if (type === "image") {
      await conn.sendMessage(
        targetJid,
        {
          image: media,
          caption
        }
      )

      return true
    }

    if (type === "video") {
      await conn.sendMessage(
        targetJid,
        {
          video: media,
          caption
        }
      )

      return true
    }

    if (type === "document") {
      await conn.sendMessage(
        targetJid,
        {
          document: media,
          mimetype:
            "application/octet-stream",
          fileName: "viewonce"
        }
      )

      return true
    }
  } catch (e) {
    console.error(
      "Error enviando contenido:",
      e
    )
  }

  return false
}

async function notify(
  conn,
  m,
  source,
  sourceType
) {
  const sender = getSender(m)

  const phone = getPhone(sender)

  const region = getCountryCode(sender)

  const flag = banderaEmoji(region)

  const name = getParticipantName(m)

  const chat = m?.chat || m?.key?.remoteJid || ""

  const groupText =
    chat.endsWith("@g.us")
      ? `\n👥 Grupo: ${chat}`
      : ""

  const info =
    `👁️ *VIEW ONCE DETECTADO*\n\n` +
    `👤 Usuario: ${name}\n` +
    `📱 Número: ${phone ? "+" + phone : "Desconocido"}\n` +
    `${flag} País: ${region || "Desconocido"}` +
    `${groupText}\n` +
    `📦 Tipo: ${sourceType}`

  for (const jid of NOTIFY_JIDS) {
    try {
      await conn.sendMessage(
        jid,
        {
          text: info
        }
      )

      if (
        SEND_VIEWONCE_CONTENT &&
        source
      ) {
        const mediaType =
          getMediaType(source)

        const mediaMessage =
          getMediaMessage(source)

        if (
          mediaType &&
          mediaMessage
        ) {
          const buffer =
            await tryDownload(
              conn,
              source,
              mediaType
            )

          if (buffer) {
            await sendViewOnceContent(
              conn,
              jid,
              buffer,
              mediaType,
              getCaption(source)
            )
          }
        }
      }
    } catch (e) {
      console.error(
        "Error notificando ViewOnce:",
        e
      )
    }
  }
}

let handler = async (
  m,
  {
    conn,
    text,
    usedPrefix,
    command
  }
) => {
  /*
   * Este plugin funciona principalmente
   * mediante handler.before.
   *
   * El comando se detecta aquí manualmente
   * porque este bot no ejecuta automáticamente
   * handler.before cuando el plugin tiene
   * handler.command.
   */

  const body =
    typeof text === "string"
      ? text.trim()
      : ""

  /*
   * Permitir también:
   * .viewoncewatch
   * .vowatch
   *
   * sin registrar handler.command.
   */

  if (
    body &&
    (
      body === "viewoncewatch" ||
      body === "vowatch"
    )
  ) {
    return
  }
}

handler.help = [
  "viewoncewatch",
  "vowatch"
]

handler.tags = [
  "owner"
]

handler.group = true
handler.owner = true

handler.before = async function (
  m,
  { conn }
) {
  try {
    if (!m) {
      return false
    }

    /*
     * Evitar procesar mensajes propios
     * cuando sea posible.
     */

    if (
      m.key?.fromMe &&
      !m.quoted
    ) {
      return false
    }

    /*
     * Restricción opcional por grupos.
     *
     * Si WATCH_GROUPS está vacío,
     * observa todos los chats permitidos.
     */

    const chat =
      m.chat ||
      m.key?.remoteJid ||
      ""

    if (
      WATCH_GROUPS.size > 0 &&
      !WATCH_GROUPS.has(chat)
    ) {
      return false
    }

    /*
     * ==================================================
     * 1. VIEW ONCE DIRECTO
     * ==================================================
     */

    let found =
      getViewOnceFromMessage(m)

    let source =
      found?.message || null

    let detection =
      found?.wrapper || null

    /*
     * ==================================================
     * 2. VIEW ONCE CITADO / RESPONDIDO
     * ==================================================
     */

    if (!found) {
      const quotedFound =
        getQuotedViewOnce(m)

      if (quotedFound) {
        found = quotedFound

        source =
          quotedFound.message || null

        detection =
          "quoted:" +
          (
            quotedFound.wrapper ||
            "unknown"
          )
      }
    }

    /*
     * ==================================================
     * 3. REVISAR quotedMessage DIRECTAMENTE
     * ==================================================
     */

    if (!found) {
      const quotedRaw =
        m?.msg?.contextInfo?.quotedMessage ||
        m?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        m?.message?.imageMessage?.contextInfo?.quotedMessage ||
        m?.message?.videoMessage?.contextInfo?.quotedMessage

      if (quotedRaw) {
        const quotedFound =
          findViewOnce(quotedRaw)

        if (quotedFound) {
          found = quotedFound

          source =
            quotedFound.message

          detection =
            "contextInfo:" +
            (
              quotedFound.wrapper ||
              "unknown"
            )
        }
      }
    }

    /*
     * Si no encontramos ViewOnce,
     * no hacemos absolutamente nada.
     */

    if (!found || !source) {
      return false
    }

    /*
     * ==================================================
     * ID REAL DEL MENSAJE
     * ==================================================
     */

    const originalId =
      m?.quoted?.id ||
      m?.msg?.contextInfo?.stanzaId ||
      m?.key?.id ||
      `${chat}:${Date.now()}`

    /*
     * Evitar duplicados.
     */

    if (alreadySeen(originalId)) {
      return false
    }

    /*
     * ==================================================
     * AVISAR
     * ==================================================
     */

    console.log(
      `[VIEWONCE] Detectado ${detection || "unknown"} | ${originalId}`
    )

    /*
     * Intentar primero reenviar el mensaje
     * usando readViewOnce.
     */

    let forwarded = false

    for (const jid of NOTIFY_JIDS) {
      forwarded =
        await forwardViewOnce(
          conn,
          m,
          jid,
          source
        )

      if (forwarded) {
        break
      }
    }

    /*
     * Si copyNForward no pudo hacerlo,
     * descargar manualmente.
     */

    if (!forwarded) {
      const mediaType =
        getMediaType(source)

      const mediaMessage =
        getMediaMessage(source)

      if (
        mediaType &&
        mediaMessage
      ) {
        const buffer =
          await tryDownload(
            conn,
            mediaMessage,
            mediaType
          )

        if (buffer) {
          for (const jid of NOTIFY_JIDS) {
            await sendViewOnceContent(
              conn,
              jid,
              buffer,
              mediaType,
              getCaption(source)
            )
          }
        }
      }
    }

    /*
     * Información del ViewOnce.
     */

    const sender =
      getSender(m)

    const phone =
      getPhone(sender)

    const region =
      getCountryCode(sender)

    const flag =
      banderaEmoji(region)

    const name =
      getParticipantName(m)

    const type =
      getMediaType(source) ||
      "desconocido"

    const info =
      `👁️ *VIEW ONCE DETECTADO*\n\n` +
      `👤 Usuario: ${name}\n` +
      `📱 Número: ${phone ? "+" + phone : "Desconocido"}\n` +
      `${flag} País: ${region || "Desconocido"}\n` +
      `📦 Tipo: ${type}\n` +
      `💬 Chat: ${chat}\n` +
      `🆔 ID: ${originalId}`

    for (const jid of NOTIFY_JIDS) {
      try {
        await conn.sendMessage(
          jid,
          {
            text: info
          }
        )
      } catch (e) {
        console.error(
          "Error enviando información ViewOnce:",
          e
        )
      }
    }

    return false

  } catch (e) {
    console.error(
      "Error en autoview:",
      e
    )

    return false
  }
}

export default handler
