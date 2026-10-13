import fetch from 'node-fetch'

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
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function getText(m) {
  return String(
    m.text ||
    m.message?.conversation ||
    m.message?.extendedTextMessage?.text ||
    m.message?.imageMessage?.caption ||
    m.message?.videoMessage?.caption ||
    ''
  ).trim()
}

function getUsers() {
  global.db ||= {}
  global.db.data ||= {}
  global.db.data.users ||= {}
  return global.db.data.users
}

async function givePrize(sender, xp, coins) {
  const users = getUsers()
  users[sender] ||= {}
  users[sender].exp = (users[sender].exp || 0) + xp
  users[sender].coin = (users[sender].coin || 0) + coins
}

async function searchITunes(query) {
  const params = new URLSearchParams({
    term: query,
    entity: 'song',
    limit: '25'
  })

  const response = await fetch(
    `https://itunes.apple.com/search?${params}`,
    { timeout: 15000 }
  )

  if (!response.ok) {
    throw new Error(`iTunes respondió HTTP ${response.status}.`)
  }

  const data = await response.json()
  return (data.results || []).filter(item => item.previewUrl)
}

function rememberBotMessage(game, message) {
  const id = message?.key?.id || message?.id
  if (id) game.botMessages.set(id, message)
  return id || null
}

async function deleteBotMessages(conn, game) {
  for (const [id, message] of game.botMessages) {
    try {
      await conn.sendMessage(game.chat, {
        delete: message?.key || {
          remoteJid: game.chat,
          fromMe: true,
          id
        }
      })
    } catch {}
  }

  game.botMessages.clear()
}

async function sendTracked(conn, game, content, options = {}) {
  const message = await conn.sendMessage(game.chat, content, options)
  rememberBotMessage(game, message)
  return message
}

async function finishGame(conn, game, text) {
  if (!game) return

  if (global.songTriviaGames.get(game.chat) === game) {
    global.songTriviaGames.delete(game.chat)
  }

  if (game.timer) clearTimeout(game.timer)

  try {
    await conn.sendMessage(game.chat, { text })
  } catch {}

  await deleteBotMessages(conn, game)
}

function getQuotedId(m) {
  return (
    m.quoted?.id ||
    m.quoted?.key?.id ||
    m.msg?.contextInfo?.stanzaId ||
    m.message?.extendedTextMessage?.contextInfo?.stanzaId ||
    m.message?.imageMessage?.contextInfo?.stanzaId ||
    m.message?.videoMessage?.contextInfo?.stanzaId ||
    m.message?.audioMessage?.contextInfo?.stanzaId ||
    m.message?.documentMessage?.contextInfo?.stanzaId ||
    null
  )
}

let handler = async function (m, { conn, text = '' } = {}) {
  const chat = m.chat

  if (global.songTriviaGames.has(chat)) {
    return m.reply('🎵 Ya hay una trivia musical en curso en este chat.')
  }

  const query = String(text || '').trim()

  if (!query) {
    return m.reply(
      '🎶 Escribe el nombre de una canción o artista.\n\n' +
      'Ejemplo: *.songtrivia Bad Bunny*'
    )
  }

  await m.reply('🔎 Buscando una canción para la trivia...')

  try {
    const songs = await searchITunes(query)

    if (!songs.length) {
      return m.reply('❌ No encontré canciones con vista previa para esa búsqueda.')
    }

    const song = songs[Math.floor(Math.random() * songs.length)]

    const audioResponse = await fetch(song.previewUrl, { timeout: 20000 })

    if (!audioResponse.ok) {
      throw new Error(`No se pudo descargar el audio: HTTP ${audioResponse.status}.`)
    }

    const audioBuffer = Buffer.from(await audioResponse.arrayBuffer())

    const game = {
      chat,
      songName: song.trackName,
      artistName: song.artistName,
      startedAt: Date.now(),
      attempts: new Map(),
      incorrectIds: [],
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

    game.audioId = rememberBotMessage(game, audioMessage)

    const prompt =
      '🎵 *TRIVIA MUSICAL*\n\n' +
      'Escucha el audio y adivina el nombre de la canción.\n\n' +
      `⏳ Tiempo: ${SONG_TRIVIA_TIME / 1000} segundos\n` +
      `❤️ Intentos por jugador: ${SONG_TRIVIA_ATTEMPTS}\n\n` +
      '💡 Escribe *.pista* citando este mensaje para recibir una pista.\n' +
      '🏳️ Escribe *.rendirse* citando este mensaje para revelar la respuesta.\n\n' +
      '⚠️ Para responder, cita este mensaje o el audio.'

    const promptMessage = await conn.sendMessage(
      chat,
      { text: prompt },
      { quoted: audioMessage || m }
    )

    game.promptMessage = promptMessage
    game.promptId = rememberBotMessage(game, promptMessage)

    game.timer = setTimeout(async () => {
      if (global.songTriviaGames.get(chat) !== game) return

      await finishGame(
        conn,
        game,
        '⏰ *¡Se acabó el tiempo!*\n\n' +
        `🎵 Canción: *${game.songName}*\n` +
        `🎤 Artista: *${game.artistName}*`
      )
    }, SONG_TRIVIA_TIME)

  } catch (error) {
    console.error('Error en songtrivia:', error)
    return m.reply(
      '❌ No se pudo iniciar la trivia musical. Inténtalo de nuevo.'
    )
  }
}

handler.before = async function (m) {
  const game = global.songTriviaGames?.get(m.chat)

  if (!game || !m.sender || m.key?.fromMe) return true

  const input = getText(m)
  if (!input) return true

  // Método de detección basado en el plugin autoband.
  const repliedMessageId = getQuotedId(m)

  const incorrectIds = Array.isArray(game.incorrectIds)
    ? game.incorrectIds
    : []

  const repliedToQuestion = Boolean(
    repliedMessageId &&
    (
      repliedMessageId === game.audioId ||
      repliedMessageId === game.promptId
    )
  )

  const repliedToIncorrect = Boolean(
    repliedMessageId &&
    incorrectIds.includes(repliedMessageId)
  )

  if (!repliedToQuestion && !repliedToIncorrect) return true

  const answer = input.trim()
  const normalizedInput = answer
    .replace(/^[.!/]/, '')
    .trim()
    .toLowerCase()

  // Evita procesar otros comandos como respuestas.
  if (
    /^[.!/]/.test(answer) &&
    !['pista', 'rendirse'].includes(normalizedInput)
  ) {
    return true
  }

  const conn = global.conn

  if (!conn) return true

  if (normalizedInput === 'pista') {
    if (game.usedHint) {
      await conn.reply(
        m.chat,
        '💡 Ya se utilizó la pista de esta ronda.',
        m
      )
      return true
    }

    game.usedHint = true

    await conn.reply(
      m.chat,
      `💡 *Pista:* el artista es *${game.artistName}*.\n` +
      '⚠️ La recompensa por acertar se reducirá a la mitad.',
      m
    )

    return true
  }

  if (normalizedInput === 'rendirse') {
    await finishGame(
      conn,
      game,
      '🏳️ *¡Se rindieron!*\n\n' +
      `🎵 Canción: *${game.songName}*\n` +
      `🎤 Artista: *${game.artistName}*`
    )

    return true
  }

  const normalizedAnswer = normalizeSong(answer)
  const normalizedTitle = normalizeSong(game.songName)

  const users = getUsers()
  const user = users[m.sender] ||= {}

  if (!game.attempts.has(m.sender)) {
    game.attempts.set(m.sender, 0)
  }

  const currentAttempts = game.attempts.get(m.sender)

  const titleMatches =
    normalizedAnswer === normalizedTitle ||
    (
      normalizedAnswer.length >= 4 &&
      normalizedTitle.includes(normalizedAnswer)
    )

  if (titleMatches) {
    const xp = game.usedHint
      ? Math.floor(SONG_TRIVIA_XP / 2)
      : SONG_TRIVIA_XP

    const coins = game.usedHint
      ? Math.floor(SONG_TRIVIA_COINS / 2)
      : SONG_TRIVIA_COINS

    await givePrize(m.sender, xp, coins)

    await finishGame(
      conn,
      game,
      '🎉 *¡RESPUESTA CORRECTA!*\n\n' +
      `🏆 Ganador: @${m.sender.split('@')[0]}\n` +
      `🎵 Canción: *${game.songName}*\n` +
      `🎤 Artista: *${game.artistName}*\n\n` +
      `✨ Recompensa: +${xp} XP\n` +
      `🪙 Monedas: +${coins}`
    )

    return true
  }

  const attempts = currentAttempts + 1
  game.attempts.set(m.sender, attempts)

  const remaining = SONG_TRIVIA_ATTEMPTS - attempts

  const incorrectMessage = await conn.reply(
    m.chat,
    remaining <= 0
      ? `❌ @${m.sender.split('@')[0]}, agotaste tus ${SONG_TRIVIA_ATTEMPTS} intentos.`
      : `❌ Respuesta incorrecta. Te quedan ${remaining} intento(s).`,
    m
  )

  const incorrectId =
    incorrectMessage?.key?.id ||
    incorrectMessage?.id

  if (incorrectId) {
    game.incorrectIds.push(incorrectId)
    game.incorrectIds = [...new Set(game.incorrectIds)]
  }

  if (remaining <= 0) {
    // El jugador agotó sus intentos, pero los demás pueden seguir jugando.
    game.attempts.set(m.sender, SONG_TRIVIA_ATTEMPTS)
  }

  return true
}

handler.help = ['songtrivia <canción o artista>']
handler.tags = ['juegos']
handler.command = ['songtrivia']
handler.group = true

export default handler
