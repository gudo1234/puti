import fs from 'fs'
import path from 'path'

let songTrivia = {}

const songTriviaFile = path.resolve(
  './src/database/songtrivia.json'
)

function ensureFile() {

  const dir = path.dirname(songTriviaFile)

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true
    })
  }

  if (!fs.existsSync(songTriviaFile)) {
    fs.writeFileSync(
      songTriviaFile,
      '{}',
      'utf8'
    )
  }
}

function loadData() {

  try {

    ensureFile()

    const data = fs.readFileSync(
      songTriviaFile,
      'utf8'
    )

    return data.trim()
      ? JSON.parse(data)
      : {}

  } catch {

    return {}
  }
}

function saveData() {

  try {

    ensureFile()

    fs.writeFileSync(
      songTriviaFile,
      JSON.stringify(
        songTrivia,
        null,
        2
      ),
      'utf8'
    )

  } catch {}
}

songTrivia = loadData()

const activeGames = {}

function getGame(chatId) {

  return songTrivia[chatId] || null
}

function saveGame(chatId, data) {

  songTrivia[chatId] = data

  saveData()
}

function clearGame(chatId) {

  if (activeGames[chatId]?.timer) {

    clearTimeout(
      activeGames[chatId].timer
    )
  }

  delete activeGames[chatId]

  delete songTrivia[chatId]

  saveData()
}

function normalizeText(text = '') {

  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(feat[^)]*\)/gi, '')
    .replace(/\[feat[^\]]*\]/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

function getCorrectAnswer(answer, song) {

  const normalized = normalizeText(answer)

  if (!normalized) {
    return false
  }

  const title = normalizeText(
    song.trackName
  )

  const artist = normalizeText(
    song.artistName
  )

  const combinations = [
    title,
    `${title}${artist}`,
    `${artist}${title}`
  ]

  return combinations.includes(
    normalized
  )
}

async function searchITunes() {

  const terms = [
    'popular music',
    'top hits',
    'latin hits',
    'reggaeton',
    'bachata',
    'romantic songs',
    'pop music',
    'rock hits',
    'urban music'
  ]

  const term =
    terms[
      Math.floor(
        Math.random() * terms.length
      )
    ]

  const url =
    `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=200&country=US`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      'Error consultando iTunes'
    )
  }

  const data = await response.json()

  const results = (
    data.results || []
  ).filter(song =>
    song.trackName &&
    song.artistName &&
    song.previewUrl
  )

  if (!results.length) {
    throw new Error(
      'iTunes no encontró canciones disponibles'
    )
  }

  return results[
    Math.floor(
      Math.random() * results.length
    )
  ]
}

async function deleteMessage(
  conn,
  chatId,
  messageId
) {

  if (!messageId) {
    return
  }

  try {

    await conn.sendMessage(
      chatId,
      {
        delete: {
          remoteJid: chatId,
          id: messageId,
          fromMe: true
        }
      }
    )

  } catch {}
}

async function deleteGameMessages(
  conn,
  chatId
) {

  const state = getGame(chatId)

  if (!state) {
    return
  }

  const ids = [
    ...(state.questionIds || []),
    ...(state.incorrectIds || [])
  ]

  const uniqueIds = [
    ...new Set(ids.filter(Boolean))
  ]

  for (const id of uniqueIds) {

    await deleteMessage(
      conn,
      chatId,
      id
    )
  }
}

async function expireGame(
  conn,
  chatId,
  timestamp
) {

  const state = getGame(chatId)

  if (
    !state ||
    state.timestamp !== timestamp
  ) {
    return
  }

  const elapsed =
    Date.now() - timestamp

  if (elapsed < 180000) {

    activeGames[chatId] = {
      timer: setTimeout(
        () => expireGame(
          conn,
          chatId,
          timestamp
        ),
        180000 - elapsed + 100
      )
    }

    return
  }

  await deleteGameMessages(
    conn,
    chatId
  )

  clearGame(chatId)
}

async function startTimer(
  conn,
  chatId,
  timestamp
) {

  if (activeGames[chatId]?.timer) {

    clearTimeout(
      activeGames[chatId].timer
    )
  }

  activeGames[chatId] = {
    timer: setTimeout(
      () => expireGame(
        conn,
        chatId,
        timestamp
      ),
      180000
    )
  }
}

let handler = async (
  m,
  { conn }
) => {

  if (!m.isGroup) {
    return m.reply(
      '❌ Este desafío solamente está disponible en grupos.'
    )
  }

  const existing = getGame(m.chat)

  if (existing) {

    const elapsed =
      Date.now() - existing.timestamp

    if (elapsed < 180000) {

      const remaining =
        180000 - elapsed

      const minutes =
        Math.floor(remaining / 60000)

      const seconds =
        Math.floor(
          (remaining % 60000) / 1000
        )

      return m.reply(
        `🎵 *Ya existe una partida de Song Trivia en este grupo.*

⏳ Tiempo restante: *${minutes} minutos y ${seconds} segundos.*

_Responde a la canción para participar._`
      )
    }

    await deleteGameMessages(
      conn,
      m.chat
    )

    clearGame(m.chat)
  }

  await m.reply(
    '🎧 *Preparando un nuevo desafío musical...*'
  )

  try {

    const song = await searchITunes()

    const audioResponse = await fetch(
      song.previewUrl
    )

    if (!audioResponse.ok) {
      throw new Error(
        'No se pudo descargar la vista previa'
      )
    }

    const audioBuffer = Buffer.from(
      await audioResponse.arrayBuffer()
    )

    if (!audioBuffer.length) {
      throw new Error(
        'El audio está vacío'
      )
    }

    const timestamp = Date.now()

    const state = {

      trackName:
        song.trackName,

      artistName:
        song.artistName,

      albumName:
        song.collectionName || 'Desconocido',

      artwork:
        song.artworkUrl100 || null,

      timestamp,

      questionIds: [],

      incorrectIds: []
    }

    saveGame(
      m.chat,
      state
    )

    const audioMessage =
      await conn.sendMessage(
        m.chat,
        {
          audio: audioBuffer,
          mimetype: 'audio/mp4',
          ptt: false
        }
      )

    const audioId =
      audioMessage?.key?.id ||
      audioMessage?.id

    if (!audioId) {

      clearGame(m.chat)

      throw new Error(
        'No se pudo enviar el audio'
      )
    }

    state.questionIds.push(
      audioId
    )

    const question =
      await conn.sendMessage(
        m.chat,
        {
          text: `🎵 *SONG TRIVIA*

🎧 Escucha atentamente la canción.

❓ *¿Cómo se llama esta canción?*

👥 _Todos pueden participar._

💬 Responde citando este mensaje con el nombre de la canción.

⏳ *Tienes 3 minutos para adivinarla.*

🏆 ¡El primero en acertar gana!`
        }
      )

    const questionId =
      question?.key?.id ||
      question?.id

    if (!questionId) {

      await deleteGameMessages(
        conn,
        m.chat
      )

      clearGame(m.chat)

      return
    }

    state.questionIds.push(
      questionId
    )

    saveGame(
      m.chat,
      state
    )

    await startTimer(
      conn,
      m.chat,
      timestamp
    )

  } catch (e) {

    clearGame(m.chat)

    await conn.reply(
      m.chat,
      `❌ No se pudo iniciar Song Trivia.\n\nError: ${e.message}`,
      m
    )
  }
}

handler.before = async function (
  m,
  { conn }
) {

  if (
    !m.isGroup ||
    !m.message ||
    m.key?.fromMe ||
    m.fromMe
  ) {
    return true
  }

  const state = getGame(m.chat)

  if (!state) {
    return true
  }

  const elapsed =
    Date.now() - state.timestamp

  if (elapsed >= 180000) {

    await deleteGameMessages(
      conn,
      m.chat
    )

    clearGame(m.chat)

    return true
  }

  const repliedId =
    m.quoted?.id

  if (!repliedId) {
    return true
  }

  const repliedToQuestion =
    (state.questionIds || []).includes(
      repliedId
    )

  const repliedToIncorrect =
    (state.incorrectIds || []).includes(
      repliedId
    )

  if (
    !repliedToQuestion &&
    !repliedToIncorrect
  ) {
    return true
  }

  const answer =
    m.text?.trim()

  if (!answer) {
    return true
  }

  if (
    getCorrectAnswer(
      answer,
      state
    )
  ) {

    await m.react('🎉')

    await deleteGameMessages(
      conn,
      m.chat
    )

    clearGame(m.chat)

    await conn.reply(
      m.chat,
      `🎉 *¡TENEMOS UN GANADOR!*

🏆 Felicidades, *${m.pushName}*.

🎵 *Canción:* ${state.trackName}

🎤 *Artista:* ${state.artistName}

💿 *Álbum:* ${state.albumName}

🔥 *¡Has demostrado que conoces la música!*

🎧 _Song Trivia · iTunes_`,
      m
    )

    return true
  }

  const remaining =
    180000 - elapsed

  const minutes =
    Math.floor(remaining / 60000)

  const seconds =
    Math.floor(
      (remaining % 60000) / 1000
    )

  await m.react('❌')

  const incorrectMessage =
    await conn.reply(
      m.chat,
      `❌ *¡Respuesta incorrecta!*

🔎 *Pista:* El artista es *${state.artistName}*.

💿 _Álbum: ${state.albumName}_

⏳ *Tiempo restante:* ${minutes} minutos y ${seconds} segundos.

🎧 _¡Inténtalo nuevamente!_`,
      m
    )

  const incorrectId =
    incorrectMessage?.key?.id ||
    incorrectMessage?.id

  if (incorrectId) {

    if (!Array.isArray(state.incorrectIds)) {
      state.incorrectIds = []
    }

    state.incorrectIds.push(
      incorrectId
    )

    state.incorrectIds = [
      ...new Set(state.incorrectIds)
    ]

    saveData()
  }

  return true
}

handler.help = [
  'songtrivia'
]

handler.tags = [
  'game'
]

handler.command = [
  'songtrivia'
]

export default handler
