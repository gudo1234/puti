import fetch from 'node-fetch'

const games = new Map()
const timers = new Map()

let handler = async (m, { conn, text, command, usedPrefix }) => {
  try {
    if (!m.isGroup) return m.reply('❌ Este comando solo funciona en grupos.')

    const chat = m.chat
    const input = String(text || '').trim()

    if (games.has(chat)) {
      return m.reply('⚠️ Ya hay una partida activa en este grupo.')
    }

    if (!input) {
      return m.reply(`🎵 Escribe el nombre de una canción.\n\nEjemplo: ${usedPrefix + command} Romeo Santos`)
    }

    await m.reply('🔎 Buscando una canción...')

    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(input)}&entity=song&limit=50&country=US`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`iTunes respondió HTTP ${response.status}`)

    const data = await response.json()
    const songs = (data.results || []).filter(song =>
      song.trackName &&
      song.artistName &&
      song.previewUrl
    )

    if (!songs.length) {
      return m.reply('❌ No encontré canciones con audio disponible. Intenta con otro nombre.')
    }

    const song = songs[Math.floor(Math.random() * songs.length)]
    const audioResponse = await fetch(song.previewUrl)

    if (!audioResponse.ok) {
      throw new Error(`No se pudo descargar el audio: HTTP ${audioResponse.status}`)
    }

    const audio = Buffer.from(await audioResponse.arrayBuffer())
    if (!audio.length) throw new Error('El audio descargado está vacío.')

    const sentAudio = await conn.sendMessage(chat, {
      audio,
      mimetype: 'audio/mp4',
      ptt: false
    }, { quoted: m })

    const sentQuestion = await conn.sendMessage(chat, {
      text: `🎧 *¡Adivina la canción!*\n\nEscucha el audio y responde a este mensaje con el nombre de la canción.\n\n⏳ Tienes 120 segundos.\n\n💡 Escribe *pista* para recibir una ayuda.`
    }, { quoted: m })

    const game = {
      answer: song.trackName,
      artist: song.artistName,
      chat,
      audioId: sentAudio?.key?.id,
      questionId: sentQuestion?.key?.id,
      allowedIds: new Set([
        sentAudio?.key?.id,
        sentQuestion?.key?.id
      ].filter(Boolean))
    }

    games.set(chat, game)

    const timer = setTimeout(async () => {
      try {
        if (games.get(chat) !== game) return

        games.delete(chat)
        timers.delete(chat)

        await conn.sendMessage(chat, {
          text: `⏰ *¡Se acabó el tiempo!*\n\n🎵 Canción: *${game.answer}*\n🎤 Artista: *${game.artist}*`
        })
      } catch (e) {
        console.error('Error en temporizador SongTrivia:', e)
        try {
          await conn.sendMessage(chat, {
            text: `❌ Error al finalizar SongTrivia:\n${e.message || e}`
          })
        } catch {}
      }
    }, 120000)

    timer.unref?.()
    timers.set(chat, timer)

  } catch (e) {
    console.error('Error en SongTrivia:', e)
    await m.reply(`❌ *Error en SongTrivia:*\n${e.stack || e.message || e}`)
  }
}

handler.before = async function (m) {
  try {
    if (!m.isGroup || !m.text || m.key?.fromMe) return

    const chat = m.chat
    const game = games.get(chat)
    if (!game) return

    const body = String(m.text || '').trim()
    if (!body) return

    const prefix = global.prefix
    if (prefix instanceof RegExp && prefix.test(body)) return

    const context = m.message?.extendedTextMessage?.contextInfo ||
      m.message?.imageMessage?.contextInfo ||
      m.message?.videoMessage?.contextInfo

    const quotedId =
      m.quoted?.id ||
      m.quoted?.key?.id ||
      context?.stanzaId

    if (!quotedId || !game.allowedIds.has(quotedId)) return

    const normalize = value => String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()

    const answer = normalize(game.answer)
    const guess = normalize(body)

    if (/^(pista|dame pista|ayuda)$/i.test(body)) {
      const words = game.answer.split(' ')
      const hint = words.map(word => word.length > 2
        ? `${word[0]}${'_'.repeat(word.length - 1)}`
        : word
      ).join(' ')

      const sentHint = await this.sendMessage(chat, {
        text: `💡 *Pista:* ${hint}\n🎤 Artista: ${game.artist}`
      }, { quoted: m })

      const hintId = sentHint?.key?.id
      if (hintId) game.allowedIds.add(hintId)
      return
    }

    if (guess === answer) {
      const timer = timers.get(chat)
      if (timer) clearTimeout(timer)

      games.delete(chat)
      timers.delete(chat)

      await this.sendMessage(chat, {
        text: `🎉 *¡Respuesta correcta!*\n\n🏆 @${m.sender.split('@')[0]} adivinó la canción.\n\n🎵 Canción: *${game.answer}*\n🎤 Artista: *${game.artist}*`,
        mentions: [m.sender]
      }, { quoted: m })

      return
    }

    const sent = await this.sendMessage(chat, {
      text: '❌ Respuesta incorrecta. ¡Inténtalo de nuevo!'
    }, { quoted: m })

    const wrongId = sent?.key?.id
    if (wrongId) game.allowedIds.add(wrongId)

  } catch (e) {
    console.error('Error en listener SongTrivia:', e)
    try {
      await m.reply(`❌ *Error en SongTrivia:*\n${e.stack || e.message || e}`)
    } catch {}
  }
}

handler.help = ['songtrivia']
handler.tags = ['game']
handler.command = ['songtrivia']

export default handler
