
const games = global.songTriviaGames ||= new Map()
const listeners = global.songTriviaListeners ||= new WeakSet()

const normalize = text => String(text || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9 ]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

function getText(message) {
  const msg = message?.message || {}

  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    msg.documentMessage?.caption ||
    msg.buttonsResponseMessage?.selectedButtonId ||
    msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
    msg.templateButtonReplyMessage?.selectedId ||
    msg.ephemeralMessage?.message?.conversation ||
    msg.ephemeralMessage?.message?.extendedTextMessage?.text ||
    ''
  )
}

function getHint(title) {
  return `🔎 Pista: comienza con *${title[0].toUpperCase()}* y tiene *${title.length} letras*.`
}

function installListener(conn) {
  if (listeners.has(conn)) return
  if (!conn.ev?.on) return

  listeners.add(conn)

  conn.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type && type !== 'notify') return

    for (const msg of messages || []) {
      try {
        const chat = msg.key?.remoteJid
        if (!chat || chat === 'status@broadcast') continue
        if (msg.key?.fromMe) continue

        const game = games.get(chat)
        if (!game) continue

        const text = getText(msg).trim()
        if (!text) continue

        if (/^[#/.!]songtrivia\b/i.test(text)) continue

        const answer = normalize(text)

        if (answer === normalize(game.track)) {
          clearTimeout(game.timer)
          games.delete(chat)

          const sender = msg.key.participant || msg.key.remoteJid

          await conn.sendMessage(chat, {
            text: `🎉 ¡CORRECTO!\n\n🏆 @${sender.split('@')[0]} adivinó la canción.\n\n🎵 *${game.track}*\n🎤 *${game.artist}*\n\n✨ ¡Felicidades!`,
            mentions: [sender]
          }, { quoted: msg })

        } else if (
          answer === 'pista' ||
          answer === 'dame pista' ||
          answer === 'ayuda'
        ) {
          await conn.sendMessage(chat, {
            text: getHint(game.track)
          }, { quoted: msg })
        }
      } catch (e) {
        console.error('[SONGTRIVIA]', e)
      }
    }
  })
}

let handler = async (m, { conn, text, command }) => {
  if (!m.isGroup) {
    return m.reply('❌ Este juego solamente funciona en grupos.')
  }

  installListener(conn)

  const chat = m.chat
  const option = normalize(text)

  if (option === 'pista') {
    const game = games.get(chat)
    if (!game) return m.reply('❌ No hay ninguna canción en juego.')
    return m.reply(getHint(game.track))
  }

  if (option === 'rendirse' || option === 'cancelar') {
    const game = games.get(chat)
    if (!game) return m.reply('❌ No hay ninguna partida activa.')

    clearTimeout(game.timer)
    games.delete(chat)

    return m.reply(
      `🏳️ La partida terminó.\n\n🎵 Canción: *${game.track}*\n🎤 Artista: *${game.artist}*`
    )
  }

  if (games.has(chat)) {
    return m.reply('🎵 Ya hay una canción en juego.\n\nEscribe *pista* para recibir una ayuda o *rendirse* para revelar la respuesta.')
  }

  try {
    await m.reply('🎧 Buscando una canción en iTunes...')

    const term = text?.trim() || 'popular music hits'

    const url = new URL('https://itunes.apple.com/search')
    url.searchParams.set('term', term)
    url.searchParams.set('entity', 'song')
    url.searchParams.set('limit', '50')
    url.searchParams.set('media', 'music')
    url.searchParams.set('country', 'US')

    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000)
    })

    if (!response.ok) {
      throw new Error(`iTunes respondió ${response.status}`)
    }

    const data = await response.json()

    const songs = (data.results || []).filter(song =>
      song.trackName &&
      song.artistName &&
      song.previewUrl
    )

    if (!songs.length) {
      return m.reply('❌ No encontré canciones con fragmento de audio. Intenta con otro género o artista.')
    }

    const song = songs[Math.floor(Math.random() * songs.length)]

    const audioResponse = await fetch(song.previewUrl, {
      signal: AbortSignal.timeout(20000)
    })

    if (!audioResponse.ok) {
      throw new Error('No se pudo descargar el fragmento de audio.')
    }

    const audio = Buffer.from(await audioResponse.arrayBuffer())

    if (!audio.length) {
      throw new Error('El audio descargado está vacío.')
    }

    const game = {
      track: song.trackName,
      artist: song.artistName,
      timer: null
    }

    games.set(chat, game)

    game.timer = setTimeout(async () => {
      if (games.get(chat) !== game) return

      games.delete(chat)

      try {
        await conn.sendMessage(chat, {
          text: `⏰ ¡Se acabó el tiempo!\n\n🎵 La canción era: *${game.track}*\n🎤 Artista: *${game.artist}*\n\n🎮 ¡Inténtalo en la próxima partida!`
        })
      } catch (e) {
        console.error('[SONGTRIVIA TIMER]', e)
      }
    }, 180000)

    await conn.sendMessage(chat, {
      audio,
      mimetype: 'audio/mp4',
      ptt: false
    }, { quoted: m })

    await conn.sendMessage(chat, {
      text: `🎶 *SONG TRIVIA*\n\n🎧 ¡Adivina qué canción está sonando!\n\n⏳ Tiempo: *3 minutos*\n🏆 El primero en responder correctamente gana.\n\n💡 Escribe *pista* si necesitas ayuda.\n🏳️ Escribe *rendirse* para revelar la canción.\n\n🎵 ¡Que comience el juego!`
    }, { quoted: m })

  } catch (e) {
    games.delete(chat)
    console.error('[SONGTRIVIA ERROR]', e)
    await m.reply(`❌ Error al iniciar SongTrivia:\n${e.message}`)
  }
}

handler.help = ['songtrivia']
handler.tags = ['game']
handler.command = ['songtrivia']

export default handler
