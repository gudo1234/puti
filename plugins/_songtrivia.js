
import fs from 'fs'
import path from 'path'

const songTriviaFile = path.resolve(
  './src/database/songtrivia.json'
)

function ensureSongTriviaFile() {
  const dir = path.dirname(songTriviaFile)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  if (!fs.existsSync(songTriviaFile)) {
    fs.writeFileSync(songTriviaFile, '{}', 'utf8')
  }
}

function loadSongTrivia() {
  try {
    ensureSongTriviaFile()
    const data = fs.readFileSync(songTriviaFile, 'utf8')
    return data.trim() ? JSON.parse(data) : {}
  } catch {
    return {}
  }
}

function saveSongTrivia(data) {
  try {
    ensureSongTriviaFile()
    fs.writeFileSync(
      songTriviaFile,
      JSON.stringify(data, null, 2),
      'utf8'
    )
  } catch (e) {
    console.error('[SONGTRIVIA SAVE]', e)
  }
}

let songTriviaData = loadSongTrivia()
let songTimers = {}

function getSongState(chatId) {
  return songTriviaData[chatId] || null
}

function saveSongState(chatId, state) {
  songTriviaData[chatId] = {
    track: state.track,
    artist: state.artist,
    audioId: state.audioId,
    questionId: state.questionId,
    incorrectIds: state.incorrectIds || [],
    timestamp: state.timestamp
  }

  saveSongTrivia(songTriviaData)
}

function clearSongState(chatId) {
  if (songTimers[chatId]) {
    clearTimeout(songTimers[chatId])
    delete songTimers[chatId]
  }

  delete songTriviaData[chatId]
  saveSongTrivia(songTriviaData)
}

function normalizeSong(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

async function deleteSongMessage(conn, chatId, messageId) {
  if (!messageId) return

  try {
    await conn.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        id: messageId,
        fromMe: true
      }
    })
  } catch {}
}

async function deleteSongChallenge(conn, chatId, state) {
  const ids = [
    state.audioId,
    state.questionId,
    ...(state.incorrectIds || [])
  ].filter(Boolean)

  for (const id of [...new Set(ids)]) {
    await deleteSongMessage(conn, chatId, id)
  }
}

function startSongTimer(conn, chatId, state) {
  if (songTimers[chatId]) {
    clearTimeout(songTimers[chatId])
  }

  const elapsed = Date.now() - state.timestamp
  const remaining = Math.max(0, 180000 - elapsed)

  songTimers[chatId] = setTimeout(async () => {
    const current = getSongState(chatId)

    if (!current || current.timestamp !== state.timestamp) {
      return
    }

    await deleteSongChallenge(conn, chatId, current)

    clearSongState(chatId)

    await conn.sendMessage(chatId, {
      text: `⏰ *¡Se acabó el tiempo!*

🎵 La canción era: *${current.track}*
🎤 Artista: *${current.artist}*

🎮 ¡Inténtalo en la próxima partida!`
    })
  }, remaining + 100)
}

let handler = async (m, { conn, text }) => {
  if (!m.isGroup) {
    return m.reply('❌ Este juego solamente funciona en grupos.')
  }

  const chatId = m.chat
  const current = getSongState(chatId)

  if (current) {
    const elapsed = Date.now() - current.timestamp

    if (elapsed < 180000) {
      return m.reply(
        '🎵 Ya hay una canción en juego.\n\nResponde al audio para participar.\nEscribe *pista* respondiendo al desafío para recibir una ayuda.'
      )
    }

    await deleteSongChallenge(conn, chatId, current)
    clearSongState(chatId)
  }

  try {
    await m.reply('🎧 Buscando una canción en iTunes...')

    const term = text?.trim() || 'top hits'

    const url = new URL('https://itunes.apple.com/search')
    url.searchParams.set('term', term)
    url.searchParams.set('entity', 'song')
    url.searchParams.set('limit', '50')
    url.searchParams.set('media', 'music')
    url.searchParams.set('country', 'US')

    const response = await fetch(url, {
      signal: AbortSignal.timeout(20000)
    })

    if (!response.ok) {
      throw new Error(`iTunes respondió con código ${response.status}`)
    }

    const data = await response.json()

    const songs = (data.results || []).filter(song =>
      song.trackName &&
      song.artistName &&
      song.previewUrl
    )

    if (!songs.length) {
      return m.reply(
        '❌ No encontré canciones disponibles.\n\nPrueba con otro artista o género.'
      )
    }

    const song = songs[
      Math.floor(Math.random() * songs.length)
    ]

    const audioResponse = await fetch(song.previewUrl, {
      signal: AbortSignal.timeout(30000)
    })

    if (!audioResponse.ok) {
      throw new Error('No se pudo descargar el audio de iTunes.')
    }

    const audio = Buffer.from(
      await audioResponse.arrayBuffer()
    )

    if (!audio.length) {
      throw new Error('El audio recibido está vacío.')
    }

    const audioMessage = await conn.sendMessage(
      chatId,
      {
        audio,
        mimetype: 'audio/mp4',
        ptt: false
      },
      { quoted: m }
    )

    const audioId =
      audioMessage?.key?.id ||
      audioMessage?.id

    if (!audioId) {
      throw new Error('No se pudo obtener el ID del audio enviado.')
    }

    const questionMessage = await conn.sendMessage(
      chatId,
      {
        text: `🎶 *SONG TRIVIA*

🎧 ¡Adivina el nombre de la canción!

🏆 El primero en responder correctamente gana.
⏳ Tienes *3 minutos*.

💡 Responde a este mensaje o al audio para participar.
🔎 Escribe *pista* respondiendo al desafío para recibir una ayuda.`
      },
      { quoted: audioMessage }
    )

    const questionId =
      questionMessage?.key?.id ||
      questionMessage?.id

    const state = {
      track: song.trackName,
      artist: song.artistName,
      audioId,
      questionId: questionId || audioId,
      incorrectIds: [],
      timestamp: Date.now()
    }

    saveSongState(chatId, state)
    startSongTimer(conn, chatId, state)

  } catch (e) {
    console.error('[SONGTRIVIA ERROR]', e)
    await m.reply(`❌ Error al iniciar SongTrivia:\n${e.message}`)
  }
}

handler.before = async function (m) {
  if (!m.isGroup || !m.message) return true

  if (m.key?.fromMe || m.fromMe) return true

  const chatId = m.chat
  const state = getSongState(chatId)

  if (!state) return true

  const elapsed = Date.now() - state.timestamp

  if (elapsed >= 180000) {
    await deleteSongChallenge(conn, chatId, state)
    clearSongState(chatId)

    await conn.sendMessage(chatId, {
      text: `⏰ *¡Se acabó el tiempo!*

🎵 La canción era: *${state.track}*
🎤 Artista: *${state.artist}*`
    })

    return true
  }

  const quotedId = m.quoted?.id

  if (!quotedId) return true

  const incorrectIds = state.incorrectIds || []

  const repliedToChallenge =
    quotedId === state.audioId ||
    quotedId === state.questionId ||
    incorrectIds.includes(quotedId)

  if (!repliedToChallenge) return true

  const answer = normalizeSong(m.text)

  if (!answer) return true

  if (
    answer === 'pista' ||
    answer === 'dame pista' ||
    answer === 'ayuda'
  ) {
    const firstLetter = state.track.charAt(0).toUpperCase()
    const remaining = Math.max(0, 180000 - elapsed)

    const minutes = Math.floor(remaining / 60000)
    const seconds = Math.floor((remaining % 60000) / 1000)

    const hint = await conn.reply(
      chatId,
      `🔎 *PISTA*

🎵 La canción comienza con la letra *${firstLetter}*.
🔠 Tiene *${state.track.length} letras*.

⏳ Tiempo restante: *${minutes} minutos y ${seconds} segundos*.`,
      m
    )

    const hintId = hint?.key?.id || hint?.id

    if (hintId) {
      state.incorrectIds.push(hintId)
      state.incorrectIds = [...new Set(state.incorrectIds)]
      saveSongState(chatId, state)
    }

    return true
  }

  if (answer === normalizeSong(state.track)) {
    await m.react('🎉')

    await conn.reply(
      chatId,
      `🎉 *¡RESPUESTA CORRECTA!*

🏆 ¡Felicidades, ${m.pushName}!

🎵 Canción: *${state.track}*
🎤 Artista: *${state.artist}*

🥇 ¡Has ganado SongTrivia!`,
      m
    )

    await deleteSongChallenge(conn, chatId, state)
    clearSongState(chatId)

    return true
  }

  await m.react('❌')

  const remaining = Math.max(0, 180000 - elapsed)
  const minutes = Math.floor(remaining / 60000)
  const seconds = Math.floor((remaining % 60000) / 1000)

  const incorrectMessage = await conn.reply(
    chatId,
    `❌ *¡Respuesta incorrecta!*

💡 Sigue intentando.

⏳ Tiempo restante: *${minutes} minutos y ${seconds} segundos*.`,
    m
  )

  const incorrectId =
    incorrectMessage?.key?.id ||
    incorrectMessage?.id

  if (incorrectId) {
    state.incorrectIds.push(incorrectId)
    state.incorrectIds = [...new Set(state.incorrectIds)]
    saveSongState(chatId, state)
  }

  return true
}

handler.help = ['songtrivia']
handler.tags = ['game']
handler.command = ['songtrivia']

export default handler
