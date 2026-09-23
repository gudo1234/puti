let handler = m => m

handler.before = async function (m, {conn, isAdmin, isBotAdmin, isOwner} ) {
  if (!m.isGroup) return !1
  let chat = global.db.data.chats[m.chat]
  if (isBotAdmin && chat.antifake && !isOwner) {
    let forbidPrefixes = ["212", "265", "234", "258", "263", "93", "967", "92", "234", "91", "254", "213"]

    const getNumber = (jid = '') => String(jid).replace(/@.+$/, '').replace(/\D/g, '')
    let target = m.sender
    if ([27, 28, 29, 30, 32].includes(m.messageStubType)) {
      const stubTarget = m.messageStubParameters?.[0]
      if (stubTarget) target = stubTarget
    }
    if (typeof target === 'string' && target.endsWith('@lid')) {
      try {
        const metadata = await conn.groupMetadata(m.chat)
        const match = metadata?.participants?.find(p => p.id === target && p.jid)
        if (match?.jid) target = match.jid
      } catch {}
    }
    const number = getNumber(target)

    for (let prefix of forbidPrefixes) {
      if (number.startsWith(prefix)) {
        const targetTag = String(target || '').replace(/@.+$/, '')
        await conn.sendMessage(m.chat, {
          text: `🚩 @${targetTag} En este grupo solo se permite personas de habla hispana.`,
          mentions: [target]
        })
        await conn.groupParticipantsUpdate(m.chat, [target], 'remove')
        return false
      }
    }
  }
  
  return true
}

export default handler
