
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
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
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
    m.message?.documentMessage?.contextInfo?.stanzaId ||
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

function rememberBotMessage(game, message) {
  const id = message?.key?.id
  if (id) game.botMessages.set(id, true)
}

async function deleteBotMessages(conn, game, keepId = null) {
  for (const id of game.botMessages.keys()) {
    if (id === keepId) continue

    try {
      await conn.sendMessage(game.chat, {
        delete: {
          remoteJid: game.chat,
          fromMe: true,
          id,
          participant: conn.user?.id
        }
      })
    } catch (error) {
      console.error('[SONGTRIVIA DELETE]', error?.message || error)
    }
  }

  game.botMessages.clear()
}

async function sendTracked(conn, chat, game, content, options = {}) {
  const sent = await conn.sendMessage(chat, content, options)
  rememberBotMessage(game, sent)
  return sent
}

async function finishGame(conn, chat, game, text, keepId = null) {
  if (global.songTriviaGames.get(chat) !== game) return

  clearTimeout(game.timer)
  global.songTriviaGames.delete(chat)

  let finalMessage

  try {
    finalMessage = await conn.sendMessage(
      chat,
      { text },
      game.promptMessage ? { quoted: game.promptMessage } : {}
    )
  } catch (error) {
    console.error('[SONGTRIVIA FINISH]', error?.message || error)
  }

  await deleteBotMessages(
    conn,
    game,
    keepId || finalMessage?.key?.id || null
  )

  return finalMessage
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

    const audioResponse = await fetch(song.previewUrl, {
      signal: AbortSignal.timeout(20000)
    })

    if (!audioResponse.ok) {
      throw new Error('No pude descargar la vista previa de la canción.')
    }

    const audioBuffer = Buffer.from(
      await audioResponse.arrayBuffer()
    )

    if (!audioBuffer.length) {
      throw new Error('El audio recibido está vacío.')
    }

    game = {
      chat,
      songName: song.trackName,
      artistName: song.artistName,
      startedAt: Date.now(),
      attempts: new Map(),
      usedHint: false,
      timer: null,
      audioId: null,
      promptId: null,
      promptMessage: null,
      botMessages: new Map()
    }

    global.songTriviaGames.set(chat, game)

    const audioMessage = await conn.sendMessage(
      chat,
      {
        audio: audioBuffer,
        mimetype: 'audio/mp4',
        ptt: false
      },
      { quoted: m }
    )

    game.audioId = audioMessage?.key?.id || null
    rememberBotMessage(game, audioMessage)

    const prefix = global.songTriviaPrefix || '.'

    const prompt =
`🎵 *TRIVIA MUSICAL*

🎧 Escucha el audio y adivina el nombre de la canción.

⏱️ Tiempo: *75 segundos*
🎯 Intentos: *${SONG_TRIVIA_ATTEMPTS} por participante*
🎁 Premio: *${SONG_TRIVIA_XP} XP* y *${SONG_TRIVIA_COINS} monedas*

📌 Debes responder citando un mensaje del bot de esta trivia.

💡 Escribe *${prefix}pista* citando un mensaje de esta ronda para conocer el artista.
🏳️ Escribe *${prefix}rendirse* citando un mensaje de esta ronda para revelar la respuesta.`

    const promptMessage = await conn.sendMessage(
      chat,
      { text: prompt },
      { quoted: audioMessage || m }
    )

    game.promptMessage = promptMessage
    game.promptId = promptMessage?.key?.id || null
    rememberBotMessage(game, promptMessage)

    game.timer = setTimeout(async () => {
      if (global.songTriviaGames.get(chat) !== game) return

      await finishGame(
        conn,
        chat,
        game,
        `⏰ *¡Se acabó el tiempo!*

🎵 Canción: *${game.songName}*
🎤 Artista: *${game.artistName}*

¡Inténtalo de nuevo!`
      )
    }, SONG_TRIVIA_TIME)

    await m.react('🎧')
  } catch (error) {
    console.error('[SONGTRIVIA]', error)

    if (game) {
      clearTimeout(game.timer)

      if (global.songTriviaGames.get(chat) === game) {
        global.songTriviaGames.delete(chat)
      }

      await deleteBotMessages(conn, game)
    }

    await m.reply(
      `❌ No pude iniciar la trivia musical.\n\n${error.message}`
    )
  }
}

handler.before = async function (m, { conn, usedPrefix = '.' } = {}) {
  const game = global.songTriviaGames.get(m.chat)

  if (!game || !m.sender || m.key?.fromMe) return false

  const input = getText(m)
  if (!input) return false

  // La respuesta debe citar un mensaje del bot registrado en esta ronda.
  const quotedId = getQuotedId(m)

  if (!quotedId || !game.botMessages.has(quotedId)) {
    return false
  }

  if (Date.now() - game.startedAt >= SONG_TRIVIA_TIME) {
    await finishGame(
      conn,
      m.chat,
      game,
      `⏰ *¡Se acabó el tiempo!*

🎵 Canción: *${game.songName}*
🎤 Artista: *${game.artistName}*`
    )
    return true
  }

  const prefix = usedPrefix || global.songTriviaPrefix || '.'
  const command = input.toLowerCase().trim()

  const isPista =
    command === `${prefix}pista`.toLowerCase() ||
    command === 'pista'

  const isRendirse =
    command === `${prefix}rendirse`.toLowerCase() ||
    command === 'rendirse'

  if (isPista) {
    if (game.usedHint) {
      await m.reply('💡 Ya utilizaron la pista de esta ronda.')
      return true
    }

    game.usedHint = true

    await sendTracked(
      conn,
      m.chat,
      game,
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

  if (isRendirse) {
    await finishGame(
      conn,
      m.chat,
      game,
      `🏳️ *La ronda ha terminado.*

🎵 Canción: *${game.songName}*
🎤 Artista: *${game.artistName}*`
    )

    return true
  }

  // No procesar otros comandos como respuestas musicales.
  if (
    command.startsWith(prefix) &&
    command.length > prefix.length
  ) {
    return false
  }

  const guess = normalizeSong(input)
  if (!guess) return false

  const answer = normalizeSong(game.songName)

  const correct =
    guess === answer ||
    (guess.length >= 5 && answer.includes(guess))

  if (correct) {
    const userAttempts = game.attempts.get(m.sender) || 0

    if (userAttempts >= SONG_TRIVIA_ATTEMPTS) {
      await m.reply('❌ Ya agotaste tus intentos en esta ronda.')
      return true
    }

    const xp = game.usedHint
      ? SONG_TRIVIA_XP / 2
      : SONG_TRIVIA_XP

    const coins = game.usedHint
      ? SONG_TRIVIA_COINS / 2
      : SONG_TRIVIA_COINS

    try {
      givePrize(m.sender, xp, coins)
    } catch (error) {
      console.error('[SONGTRIVIA PREMIO]', error)

      await finishGame(
        conn,
        m.chat,
        game,
        `🎉 ¡Respuesta correcta!

🎵 *${game.songName}* — ${game.artistName}

⚠️ No pude guardar el premio: ${error.message}`
      )

      return true
    }

    clearTimeout(game.timer)
    global.songTriviaGames.delete(m.chat)

    const finalMessage = await conn.sendMessage(
      m.chat,
      {
        text:
`🎉 *¡RESPUESTA CORRECTA!*

👤 Ganador: @${m.sender.split('@')[0]}

🎵 Canción: *${game.songName}*
🎤 Artista: *${game.artistName}*

🎁 *Premios recibidos*
✨ +${xp} XP
🪙 +${coins} monedas`,
        mentions: [m.sender]
      },
      { quoted: m }
    )

    // Conservar el mensaje final de respuesta correcta.
    await deleteBotMessages(
      conn,
      game,
      finalMessage?.key?.id || null
    )

    return true
  }

  const attempts = (game.attempts.get(m.sender) || 0) + 1
  game.attempts.set(m.sender, attempts)

  const remaining = SONG_TRIVIA_ATTEMPTS - attempts

  if (remaining <= 0) {
    await sendTracked(
      conn,
      m.chat,
      game,
      {
        text:
`❌ @${m.sender.split('@')[0]}, agotaste tus intentos.

🎵 Los demás participantes todavía pueden responder.`,
        mentions: [m.sender]
      },
      { quoted: m }
    )

    return true
  }

  await sendTracked(
    conn,
    m.chat,
    game,
    {
      text:
`❌ Respuesta incorrecta, @${m.sender.split('@')[0]}.

🎯 Te quedan *${remaining} intentos*.`,
      mentions: [m.sender]
    },
    { quoted: m }
  )

  return true
}

handler.help = ['songtrivia [búsqueda opcional]']
handler.tags = ['juegos']
handler.command = ['songtrivia']

export default handler
