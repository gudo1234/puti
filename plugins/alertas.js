let WAMessageStubType = (await import('@whiskeysockets/baileys')).default

let handler = m => m

handler.before = async function (m, { conn, participants }) {
  try {
    if (!m?.isGroup) return
    if (![29, 30].includes(m.messageStubType)) return

    const chat = global?.db?.data?.chats?.[m.chat]
    if (!chat?.detect) return

    const safe = v =>
      typeof v === 'string' ? v : ''

    const first = jid =>
      safe(jid).split('@')[0]

    const parseTarget = value => {
      if (!value) return null

      if (typeof value === 'object') return value

      if (typeof value === 'string') {
        const text = value.trim()

        if (text.startsWith('{') && text.endsWith('}')) {
          try {
            return JSON.parse(text)
          } catch {}
        }

        return { id: text }
      }

      return null
    }

    const actor =
      m?.sender ||
      m?.key?.participant ||
      m?.participant ||
      ''

    const targetRaw =
      m?.messageStubParameters?.[0]

    if (!targetRaw) return

    const targetData = parseTarget(targetRaw)

    if (!targetData) return

    const target =
      targetData?.id ||
      targetData?.jid ||
      ''

    if (!target) return

    const adminJids =
      (participants || [])
        .filter(p =>
          p?.admin === 'admin' ||
          p?.admin === 'superadmin'
        )
        .map(p => p?.id)
        .filter(Boolean)

    const mentions = Array.from(
      new Set([
        ...adminJids,
        actor,
        target
      ].filter(Boolean))
    )

    const accion =
      m.messageStubType === 29
        ? '*le ha dado administración a el usuario:*'
        : '*le ha quitado la administración a el usuario:*'

    await conn.sendMessage(
      m.chat,
      {
        text:
`${e} El administrador @${first(actor)} ${accion} @${first(target)}`,
        mentions
      }
    )

  } catch (err) {
    console.error('[detect-admin.before]', err, {
      stub: m?.messageStubType,
      type: WAMessageStubType?.[m?.messageStubType],
      actor: m?.sender || m?.key?.participant,
      target: m?.messageStubParameters?.[0]
    })
  }
}

export default handler
