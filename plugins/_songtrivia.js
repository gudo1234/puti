
const SONG_TRIVIA_TIME = 75_000
const SONG_TRIVIA_XP = 400
const SONG_TRIVIA_COINS = 150
const SONG_TRIVIA_ATTEMPTS = 3

global.songTriviaGames ||= new Map()

function normalizeSong(text = '') {
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\b(feat|ft|featuring)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getText(m) {
  return String(
    m.text ||
    m.body ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    ''
  ).trim()
}

function getQuotedId(m) {
  return (
    m.quoted?.id ||
    m.message?.extendedTextMessage?.contextInfo?.stanzaId ||
    m.message?.imageMessage?.contextInfo?.stanzaId ||
    m.message?.videoMessage?.contextInfo?.stanzaId ||
    m.message?.audioMessage?.contextInfo?.stanzaId ||
    null
  )
}

function getUsers() {
  if (!global.db?.data) {
    throw new Error('No se encontró global.db.data.')
  }

  global.db.data.users ||= {}
  return global.db.data.users
}

function givePrize(sender, xp, coins) {
  const users = getUsers()
  const user = users[sender] ||= {}

  user.exp = (Number(user.exp) || 0) + xp

  const coinKey = [
    'coin',
    'coins',
    'money',
    'moneda',
    'monedas'
  ].find(key =>
    Object.prototype.hasOwnProperty.call(user, key)
  ) || 'money'

  user[coinKey] = (Number(user[coinKey]) || 0) + coins
}

async function searchITunes(term = '') {
  const params = new URLSearchParams({
    term: term.trim() || 'popular songs',
    entity: 'song',
    limit: '50',
    country: 'US'
  })

  const response = await fetch(
    `https://itunes.apple.com/search?${params}`,
    { signal: AbortSignal.timeout(15000) }
  )

  if (!response.ok) {
    throw new Error(`iTunes respondió HTTP ${response.status}.`)
  }

  const data = await response.json()

  const songs = (data.results || []).filter(song =>
    song.trackName &&
    song.artistName &&
    song.previewUrl
  )

  if (!songs.length) {
    throw new Error(
      'No encontré canciones con vista previa. Prueba con otro nombre.'
    )
  }

  return songs[Math.floor(Math.random() * songs.length)]
}

async function finishGame(conn, chat, game, text) {
  if (global.songTriviaGames.get(chat) !== game) return

  clearTimeout(game.timer)
  global.songTriviaGames.delete(chat)

  await conn.sendMessage(
    chat,
    { text },
    game.promptMessage
      ? { quoted: game.promptMessage }
      : {}
  )
}

let handler = async (m, { conn, text = '' }) => {
  const chat = m.chat

  if (global.songTriviaGames.has(chat)) {
    return m.reply(
      '🎵 Ya hay una trivia musical activa en este chat. Termina esa ronda primero.'
    )
  }

  let game

  try {
    await m.react('🎵')

    const song = await searchITunes(text)

    const audioResponse = await fetch(
      song.previewUrl,
      { signal: AbortSignal.timeout(20000) }
    )

    if (!audioResponse.ok) {
      throw new Error('No pude descargar la vista previa de la canción.')
    }

    const audioBuffer = Buffer.from(
      await audioResponse.arrayBuffer()
    )

    if (!audioBuffer.length) {
      throw new Error('El audio recibido está vacío.')
    }

    const audioMessage = await conn.sendMessage(
      chat,
      {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        ptt: false
      },
      { quoted: m }
    )

    const prefix = global.songTriviaPrefix || '.'

    const prompt =
`🎵 *TRIVIA MUSICAL*

🎧 Escucha el audio y adivina el nombre de la canción.

⏱️ Tiempo: *75 segundos*
🎯 Intentos: *${SONG_TRIVIA_ATTEMPTS}*
🎁 Premio: *${SONG_TRIVIA_XP} XP* y *${SONG_TRIVIA_COINS} monedas*

📌 *Responde citando este mensaje con el nombre de la canción.*

💡 Escribe *${prefix}pista* citando la trivia para conocer el artista.
🏳️ Escribe *${prefix}rendirse* citando la trivia para revelar la respuesta.`

    const promptMessage = await conn.sendMessage(
      chat,
      { text: prompt },
      { quoted: audioMessage || m }
    )

    game = {
      player: m.sender,
      songName: song.trackName,
      artistName: song.artistName,
      audioId: audioMessage?.key?.id || null,
      promptId: promptMessage?.key?.id || null,
      promptMessage,
      attempts: 0,
      usedHint: false,
      timer: null
    }

    global.songTriviaGames.set(chat, game)

    game.timer = setTimeout(async () => {
      if (global.songTriviaGames.get(chat) !== game) return

      try {
        await finishGame(
          conn,
          chat,
          game,
          `⏰ *¡Se acabó el tiempo!*

🎵 Canción: *${game.songName}*
🎤 Artista: *${game.artistName}*

¡Inténtalo de nuevo!`
        )
      } catch (error) {
        console.error('[SONGTRIVIA]', error)
      }
    }, SONG_TRIVIA_TIME)

    await m.react('🎧')
  } catch (error) {
    console.error('[SONGTRIVIA]', error)

    if (game) {
      clearTimeout(game.timer)
      global.songTriviaGames.delete(chat)
    }

    await m.reply(
      `❌ No pude iniciar la trivia musical.\n\n${error.message}`
    )
  }
}

handler.before = async function (m, { conn, usedPrefix = '.' }) {
  const game = global.songTriviaGames.get(m.chat)

  if (!game) return false

  const input = getText(m)

  if (!input) return false

  const prefix = usedPrefix || '.'
  const command = input.toLowerCase().trim()
  const pista = `${prefix}pista`.toLowerCase()
  const rendirse = `${prefix}rendirse`.toLowerCase()

  const isPista =
    command === pista ||
    command === 'pista'

  const isRendirse =
    command === rendirse ||
    command === 'rendirse'

  const quotedId = getQuotedId(m)

  const quotedTrivia = Boolean(
    quotedId &&
    (
      quotedId === game.promptId ||
      quotedId === game.audioId
    )
  )

  if (m.sender !== game.player) {
    return false
  }

  if (Date.now() - gameStartTime(game) >= SONG_TRIVIA_TIME) {
    await finishGame(
      conn,
      m.chat,
      game,
      `⏰ *¡Se acabó el tiempo!*\n\n🎵 Canción: *${game.songName}*\n🎤 Artista: *${game.artistName}*`
    )
    return true
  }

  if (isPista || isRendirse) {
    if (!quotedTrivia) {
      await m.reply(
        '↩️ Responde citando el mensaje de la trivia para usar esa opción.'
      )
      return true
    }

    if (isPista) {
      if (game.usedHint) {
        await m.reply('💡 Ya utilizaste la pista de esta ronda.')
        return true
      }

      game.usedHint = true

      await conn.sendMessage(
        m.chat,
        {
          text:
`💡 *PISTA MUSICAL*

🎤 Artista: *${game.artistName}*

🎁 Premio reducido:
*${SONG_TRIVIA_XP / 2} XP* y *${SONG_TRIVIA_COINS / 2} monedas*`
        },
        { quoted: m }
      )

      return true
    }

    await finishGame(
      conn,
      m.chat,
      game,
      `🏳️ *Te has rendido.*

🎵 Canción: *${game.songName}*
🎤 Artista: *${game.artistName}*`
    )

    return true
  }

  if (!quotedTrivia) return false

  if (
    command.startsWith(prefix) &&
    command.length > prefix.length
  ) {
    return false
  }

  const guess = normalizeSong(input)
  const answer = normalizeSong(game.songName)

  if (!guess) return true

  const correct =
    guess === answer ||
    (guess.length >= 5 && answer.includes(guess))

  if (correct) {
    const xp = game.usedHint
      ? SONG_TRIVIA_XP / 2
      : SONG_TRIVIA_XP

    const coins = game.usedHint
      ? SONG_TRIVIA_COINS / 2
      : SONG_TRIVIA_COINS

    try {
      givePrize(m.sender, xp, coins)

      await m.react('🎉')

      await finishGame(
        conn,
        m.chat,
        game,
        `🎉 *¡RESPUESTA CORRECTA!*

🎵 Canción: *${game.songName}*
🎤 Artista: *${game.artistName}*

🎁 *Premios recibidos*
✨ +${xp} XP
🪙 +${coins} monedas`
      )
    } catch (error) {
      console.error('[SONGTRIVIA PREMIO]', error)

      await finishGame(
        conn,
        m.chat,
        game,
        `🎉 ¡Acertaste!\n\n🎵 *${game.songName}* — ${game.artistName}\n\n⚠️ No pude guardar el premio: ${error.message}`
      )
    }

    return true
  }

  game.attempts++

  const remaining = SONG_TRIVIA_ATTEMPTS - game.attempts

  if (remaining <= 0) {
    await finishGame(
      conn,
      m.chat,
      game,
      `❌ *Se acabaron tus intentos.*

🎵 Canción: *${game.songName}*
🎤 Artista: *${game.artistName}*`
    )

    return true
  }

  await m.reply(
    `❌ Respuesta incorrecta.\n\n🎯 Intentos restantes: *${remaining}*`
  )

  return true
}

function gameStartTime(game) {
  return game.startedAt || Date.now()
}

handler.help = ['songtrivia [búsqueda opcional]']
handler.tags = ['juegos']
handler.command = ['songtrivia']

export default handler
