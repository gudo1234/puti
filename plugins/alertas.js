const { default: PhoneNumber } = await import('awesome-phonenumber')
const { default: WAMessageStubType } = await import('@whiskeysockets/baileys')

const regionNames = new Intl.DisplayNames(['es'], {
  type: 'region'
})

const banderaEmoji = c =>
  !c || c.length !== 2
    ? '🌐'
    : [...c.toUpperCase()]
        .map(x =>
          String.fromCodePoint(
            0x1F1E6 - 65 + x.charCodeAt(0)
          )
        )
        .join('')

const safe = v => (typeof v === 'string' ? v : '')

const limpiarId = jid =>
  safe(jid)
    .split('@')[0]
    .replace(/\D/g, '')

const obtenerNumeroReal = participante => {
  if (!participante) return ''

  const posibles = [
    participante.phoneNumber,
    participante.jid,
    participante.id
  ]

  for (const valor of posibles) {
    const numero = limpiarId(valor)
    if (numero && numero.length >= 7) {
      return numero
    }
  }

  return ''
}

const buscarParticipante = (participants, jid) => {
  const buscado = safe(jid)

  if (!buscado) return null

  return (
    participants.find(p =>
      safe(p.id) === buscado ||
      safe(p.jid) === buscado ||
      safe(p.phoneNumber) === buscado
    ) ||

    participants.find(p => {
      const a = limpiarId(p.id)
      const b = limpiarId(p.jid)
      const c = limpiarId(p.phoneNumber)

      const x = limpiarId(buscado)

      return x && (x === a || x === b || x === c)
    }) ||

    null
  )
}

const numeroMostrar = (participante, fallback = '') => {
  const numero = obtenerNumeroReal(participante)

  if (numero) return '+' + numero

  const limpio = limpiarId(fallback)

  return limpio
    ? '+' + limpio
    : 'Desconocido'
}

let handler = m => m

handler.before = async function (m, { conn, participants }) {
  try {
    if (!m?.isGroup) return
    if (![29, 30].includes(m.messageStubType)) return

    const chat = global?.db?.data?.chats?.[m.chat]
    if (!chat?.detect) return
    let lista = Array.isArray(participants)
      ? participants
      : []

    if (!lista.length) {
      try {
        const metadata = await conn.groupMetadata(m.chat)
        lista = metadata?.participants || []
      } catch {}
    }

    const actorJid =
      m?.sender ||
      m?.key?.participant ||
      m?.participant ||
      ''

    const targetJid =
      m?.messageStubParameters?.[0] ||
      ''

    if (!targetJid) return
    const actor = buscarParticipante(lista, actorJid)
    const target = buscarParticipante(lista, targetJid)
    const actorNumber = numeroMostrar(actor, actorJid)
    const targetNumber = numeroMostrar(target, targetJid)
    const adminJids = lista
      .filter(p =>
        p.admin === 'admin' ||
        p.admin === 'superadmin'
      )
      .map(p =>
        p.id ||
        p.jid ||
        p.phoneNumber
      )
      .filter(Boolean)

    const mentions = Array.from(
      new Set([
        ...adminJids,
        actorJid,
        targetJid
      ].filter(Boolean))
    )
    const obtenerPais = numero => {
      try {
        const limpio = limpiarId(numero)

        if (!limpio) {
          return {
            pais: 'Desconocido',
            bandera: '🌐'
          }
        }

        const pn = new PhoneNumber('+' + limpio)
        const code = pn.getRegionCode() || '??'

        return {
          pais:
            code !== '??'
              ? regionNames.of(code) || 'Desconocido'
              : 'Desconocido',
          bandera: banderaEmoji(code)
        }
      } catch {
        return {
          pais: 'Desconocido',
          bandera: '🌐'
        }
      }
    }

    const actorInfo = obtenerPais(actorNumber)
    const targetInfo = obtenerPais(targetNumber)

    if (m.messageStubType === 29) {
      await conn.sendMessage(
        m.chat,
        {
          text:
`🎯 @${limpiarId(targetJid)} ahora es *admin* del grupo.

📱 Número real: *${targetNumber}*
🌎 País: ${targetInfo.bandera} ${targetInfo.pais}

> Acción realizada por: @${limpiarId(actorJid)}
> 📱 Número real: *${actorNumber}*
> 🌎 País: ${actorInfo.bandera} ${actorInfo.pais}`,
          mentions
        },
        { quoted: m }
      )
    }

    if (m.messageStubType === 30) {
      await conn.sendMessage(
        m.chat,
        {
          text:
`🏮 @${limpiarId(targetJid)} *ya no es admin* del grupo.

📱 Número real: *${targetNumber}*
🌎 País: ${targetInfo.bandera} ${targetInfo.pais}

> Acción realizada por: @${limpiarId(actorJid)}
> 📱 Número real: *${actorNumber}*
> 🌎 País: ${actorInfo.bandera} ${actorInfo.pais}`,
          mentions
        },
        { quoted: m }
      )
    }

  } catch (e) {
    console.error(
      '[detect-admin.before]',
      e,
      {
        stub: m?.messageStubType,
        type: WAMessageStubType?.[m?.messageStubType],
        actor: m?.sender || m?.key?.participant,
        target: m?.messageStubParameters?.[0]
      }
    )
  }
}

export default handler
