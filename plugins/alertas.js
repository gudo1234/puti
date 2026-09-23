let WAMessageStubType = (await import('@whiskeysockets/baileys')).default

let handler = m => m

handler.before = async function (m, { conn, participants }) {
  try {
    if (!m?.isGroup) return
    if (![29, 30].includes(m.messageStubType)) return

    const chat = global?.db?.data?.chats?.[m.chat]
    if (!chat?.detect) return

    const safe = v => (typeof v === 'string' ? v : '')
    const first = jid => safe(jid).split('@')[0]

    const actor =
      m?.sender ||
      m?.key?.participant ||
      m?.participant ||
      ''

    const target = safe(m?.messageStubParameters?.[0])
    if (!target) return
    const adminJids = participants
      .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
      .map(p => p.id)
    const mentions = Array.from(
      new Set([
        ...adminJids,
        actor,
        target
      ].filter(Boolean))
    )

    if (m.messageStubType === 29) {
      await conn.sendMessage(m.chat, {
        text:
`🎯 @${first(target)} ahora es *admin* del grupo.

> Acción realizada por: @${first(actor)}`,
        mentions
      })
    }

    if (m.messageStubType === 30) {
      await conn.sendMessage(m.chat, {
        text:
`🏮 @${first(target)} *ya no es admin* del grupo.

> Acción realizada por: @${first(actor)}`,
        mentions
      })
    }

  } catch (e) {
    console.error('[detect-admin.before]', e, {
      stub: m?.messageStubType,
      type: WAMessageStubType?.[m?.messageStubType]
    })
  }
}

export default handler
