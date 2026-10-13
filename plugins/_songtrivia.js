
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

function getMessageText(m) {
  return (
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
    m.message?.contextInfo?.stanzaId ||
    null
  )
}

function isTriviaMessage(m, game) {
  const quotedId = getQuotedId(m)

  return Boolean(
    quotedId &&
    (
      quotedId === game.promptId ||
      quotedId === game.audioId
    )
  )
}

function getUserDatabase() {
  if (!global.db) {
    throw new Error('No se encontró global.db.')
  }

  if (!global.db.data) {
    throw new Error('No se encontró global.db.data.')
  }

  if (!global.db.data.users) {
    global.db.data.users = {}
  }

  return global.db.data.users
}

function givePrize(sender, xp, coins) {
  const users = getUserDatabase()
  const user = users[sender] ||= {}

  user.exp = (Number(user.exp) || 0) + xp

  // Utiliza el campo de monedas que ya exista en tu base de datos.
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
  const query = term.trim() || 'top hits'

  const params = new URLSearchParams({
    term: query,
    entity: 'song',
    limit: '50',
    country: 'US'
  })

  const response = await fetch(
    `https://itunes.apple.com/search?${params}`,
    {
      signal: AbortSignal.timeout(15000)
    }
  )

  if (!response.ok) {
    throw new Error(`iTunes respondió con HTTP ${response.status}.`)
  }

  const data = await response.json()

  const songs = (data.results || []).filter(song =>
    song.trackName &&
    song.artistName &&
    song.previewUrl
  )

  if (!songs.length) {
    throw new Error(
      'No encontré canciones con audio de vista previa en iTunes. Prueba otra búsqueda.'
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
    { quoted: game.promptMessage || undefined }
  )
}

let handler = async (m, { conn, text = '' }) => {
  const chat = m.chat

  if (global.songTriviaGames.has(chat)) {
    return m.reply(
      '🎵 Ya hay una trivia musical activa en este chat. Termina esa ronda antes de iniciar otra.'
    )
  }

  try {
    await m.react('🎵')

    const song = await searchITunes(text)

    const audioMessage = await conn.sendMessage(
      chat,
      {
        audio: { url: song.previewUrl },
        mimetype: 'audio/mpeg',
        ptt: false
      },
      { quoted: m }
    )

    const prompt = `*🎵 TRIVIA MUSICAL* · _🔊 Oye y dime qué canción es_

🎧 Escucha el audio de arriba y escribe cómo se llama la canción.
_Aquí no hay opciones: hay que saberla._

• ⏱️ Tiempo: *1 min 15 s*
• 🎁 Premio: *${SONG_TRIVIA_XP} XP* y *${SONG_TRIVIA_COINS} monedas*
• 🎯 Tus intentos: *${SONG_TRIVIA_ATTEMPTS}*

*👉 Responde a ESTE mensaje* (cítalo) con el nombre de la canción. Solo cuentan las tuyas.
> *${global.songTriviaPrefix || '.'}pista* → te digo de quién es (premio a la mitad)
> *${global.songTriviaPrefix || '.'}rendirse* → ver la respuesta`

    const promptMessage = await conn.sendMessage(
      chat,
      { text: prompt },
      { quoted: audioMessage }
    )

    const game = {
      player: m.sender,
      songName: song.trackName,
      artistName: song.artistName,
      collectionName: song.collectionName || '',
      audioId: audioMessage?.key?.id,
      promptId: promptMessage?.key?.id,
      promptMessage,
      attempts: 0,
      usedHint: false,
      startedAt: Date.now(),
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

¡La próxima vez será!`
        )
      } catch (error) {
        console.error('[SONGTRIVIA]', error.message)
      }
    }, SONG_TRIVIA_TIME)

    await m.react('🎧')
  } catch (error) {
    console.error('[SONGTRIVIA]', error)

    await m.reply(
      `❌ No pude iniciar la trivia musical.\n\n${error.message}`
    )
  }
}

handler.before = async function (m, { conn, usedPrefix = '.' }) {
  const game = global.songTriviaGames.get(m.chat)

  if (!game) return false

  const text = getMessageText(m)
  if (!text) return false

  // Solo participa quien inició la trivia.
  if (m.sender !== game.player) return false

  const input = text.trim()
  const command = input.toLowerCase()

  const pistaCommand = `${usedPrefix}pista`.toLowerCase()
  const rendirseCommand = `${usedPrefix}rendirse`.toLowerCase()

  const isPista =
    command === pistaCommand ||
    command === 'pista'

  const isRendirse =
    command === rendirseCommand ||
    command === 'rendirse'

  // No acepta respuestas ni acciones si no se cita la trivia.
  if (!isTriviaMessage(m, game)) {
    if (isPista || isRendirse) {
      await m.reply(
        '↩️ Responde citando el mensaje de la trivia para usar esa opción.'
      )
      return true
    }

    return false
  }

  if (isPista) {
    if (game.usedHint) {
      await m.reply('💡 Ya utilizaste la pista en esta ronda.')
      return true
    }

    game.usedHint = true

    await conn.sendMessage(
      m.chat,
      {
        text: `💡 *PISTA MUSICAL*\n\n🎤 El artista es: *${game.artistName}*\n\n🎁 Si aciertas, recibirás la mitad del premio: *${SONG_TRIVIA_XP / 2} XP* y *${SONG_TRIVIA_COINS / 2} monedas*.\n\n⏱️ El tiempo sigue corriendo.`,
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
      `🏳️ *¡Te has rendido!*

🎵 La canción era: *${game.songName}*
🎤 Artista: *${game.artistName}*

¡Vuelve a intentarlo con otra ronda!`
    )

    return true
  }

  // Ignora comandos ajenos a la trivia.
  if (
    input.startsWith(usedPrefix) &&
    input.length > usedPrefix.length
  ) {
    return false
  }

  const guess = normalizeSong(input)
  const answer = normalizeSong(game.songName)

  if (!guess) return true

  // Coincidencia exacta o título incluido en la respuesta.
  const correct =
    guess === answer ||
    (
      answer.length >= 5 &&
      guess.includes(answer)
    ) ||
    (
      guess.length >= 5 &&
      answer.includes(guess)
    )

  if (correct) {
    const xp = game.usedHint
      ? SONG_TRIVIA_XP / 2
      : SONG_TRIVIA_XP

    const coins = game.usedHint
      ? SONG_TRIVIA_COINS / 2
      : SONG_TRIVIA_COINS

    try {
      givePrize(m.sender, xp, coins)

      await finishGame(
        conn,
        m.chat,
        game,
        `🎉 *¡CORRECTO!*

🎵 Canción: *${game.songName}*
🎤 Artista: *${game.artistName}*

🎁 Premio recibido:
✨ *+${xp} XP*
🪙 *+${coins} monedas*

${game.usedHint ? '💡 Premio reducido por utilizar la pista.' : '🔥 ¡Adivinaste sin pistas!'}`
      )
    } catch (error) {
      console.error('[SONGTRIVIA PREMIO]', error)

      await finishGame(
        conn,
        m.chat,
        game,
        `🎉 ¡Acertaste! La canción era *${game.songName}*, de *${game.artistName}*.\n\n⚠️ No pude guardar el premio: ${error.message}`
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
      `❌ *¡Se acabaron tus intentos!*

🎵 La canción era: *${game.songName}*
🎤 Artista: *${game.artistName}*

¡Suerte en la próxima ronda!`
    )

    return true
  }

  await m.reply(
    `❌ Esa no es la canción.\n\n🎯 Intentos restantes: *${remaining}*\n⏱️ ¡Todavía tienes tiempo!`
  )

  return true
}

handler.help = ['songtrivia [búsqueda opcional]']
handler.tags = ['juegos']
handler.command = ['songtrivia']
handler.group = true

export default handler
