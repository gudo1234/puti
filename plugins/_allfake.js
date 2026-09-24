import PhoneNumber from "awesome-phonenumber"
import fetch from 'node-fetch'
import sharp from 'sharp'

const getRandom = (arr) =>
  arr[Math.floor(Math.random() * arr.length)]

async function getRandomChannel() {
  const canalIdM = [
    "120363285614743024@newsletter",
    "120363395205399025@newsletter"
  ]

  const canalNombreM = [
    "🤖⃧►iʑυвöτ◃2.0▹",
    "Zeus Bot🔆Channel-OFC"
  ]

  const idx =
    Math.floor(
      Math.random() * canalIdM.length
    )

  return {
    id: canalIdM[idx],
    name: canalNombreM[idx]
  }
}

global.canalIdM = [
  "120363285614743024@newsletter",
  "120363395205399025@newsletter"
]

global.canalNombreM = [
  "🤖⃧►iʑυвöτ◃2.0▹",
  "Zeus Bot🔆Channel-OFC"
]

global.channelRD =
  await getRandomChannel()

global.mundo = async function (
  m,
  conn,
  realUserNumber = ''
) {
  try {
    let num =
      String(realUserNumber || '')
        .replace(/\D/g, '')
    if (
      !num ||
      num.length < 7
    ) {
      let realSender =
        m.sender || ''
      if (
        realSender.endsWith('@lid') &&
        m.isGroup
      ) {
        const metadata =
          await conn.groupMetadata(
            m.chat
          ).catch(() => null)

        const participants =
          metadata?.participants || []

        const match =
          participants.find(p =>
            p.id === realSender ||
            p.jid === realSender ||
            p.lid === realSender
          )

        if (match) {
          const possibleNumber =
            match.phoneNumber ||
            match.jid ||
            ''

          num =
            String(possibleNumber)
              .split('@')[0]
              .replace(/\D/g, '')
        }
      } else {
        num =
          realSender
            .split('@')[0]
            .replace(/\D/g, '')
      }
    }
    if (
      !num ||
      num.length < 7
    ) {
      return {
        numero: 'desconocido',
        region: 'ZZ',
        country: 'Desconocido',
        flag: '🌐'
      }
    }
    const pn =
      PhoneNumber('+' + num)

    let region =
      pn.getRegionCode() || 'ZZ'

    region =
      String(region)
        .toUpperCase()
    if (
      !region ||
      region === 'ZZ'
    ) {
      return {
        numero: '+' + num,
        region: 'ZZ',
        country: 'Desconocido',
        flag: '🌐'
      }
    }
    let country =
      'Desconocido'

    try {
      const intl =
        new Intl.DisplayNames(
          ['es'],
          {
            type: 'region'
          }
        )

      country =
        intl.of(region) ||
        'Desconocido'
    } catch {}
    let flag = '🌐'

    if (
      region.length === 2
    ) {
      flag =
        [...region]
          .map(c =>
            String.fromCodePoint(
              127397 +
              c.charCodeAt(0)
            )
          )
          .join('')
    }

    return {
      numero: '+' + num,
      region,
      country,
      flag
    }

  } catch {
    return {
      numero: 'desconocido',
      region: 'ZZ',
      country: 'Desconocido',
      flag: '🌐'
    }
  }
}

const responseIcono =
  await fetch(icono)

if (!responseIcono.ok) {
  throw new Error(
    'No se pudo obtener el icono'
  )
}

const iconoBuffer =
  Buffer.from(
    await responseIcono.arrayBuffer()
  )

const rcanalThumbnail =
  await sharp(iconoBuffer)
    .resize(640, 640, {
      fit: "cover",
      position: "centre"
    })
    .jpeg({
      quality: 100,
      chromaSubsampling: "4:4:4"
    })
    .toBuffer()

global.rcanal = {
  linkPreview: {
    "matched-text": redes,
    title: textbot,
    description: wm,
    jpegThumbnail:
      rcanalThumbnail,
    renderLargerThumbnail:
      false
  },

  contextInfo: {
    isForwarded: true,

    forwardedNewsletterMessageInfo: {
      newsletterJid:
        global.channelRD.id,

      serverMessageId:
        100,

      newsletterName:
        global.channelRD.name
    }
  }
}

export async function before(
  m,
  { conn }
) {
  global.fake = {
    contextInfo: {
      isForwarded: true,

      forwardedNewsletterMessageInfo: {
        newsletterJid:
          global.channelRD.id,

        newsletterName:
          global.channelRD.name,

        serverMessageId:
          -1
      }
    },

    quoted: m
  }

  global.rwait = '🕒'
  global.done = '✅'
  global.error = '✖️'
  global.msm = '⚠︎'

  global.emoji = '🪴'
  global.emoji2 = '🍁'
  global.emoji3 = '🍎'
  global.emoji4 = '⚡'
  global.emoji5 = '🌱'

  global.emojis =
    getRandom([
      global.emoji,
      global.emoji2,
      global.emoji3,
      global.emoji4,
      global.emoji5
    ])

  global.e1 = '🪴'
  global.e2 = '🍁'
  global.e3 = '🍎'
  global.e4 = '⚡'
  global.e5 = '🌱'

  global.ePick =
    getRandom([
      global.e1,
      global.e2,
      global.e3,
      global.e4,
      global.e5
    ])

  global.s1 = '➪'
  global.s2 = '➺'
  global.s3 = '➣'
  global.s4 = '⬭'
  global.s5 = '⬖'

  global.s =
    getRandom([
      global.s1,
      global.s2,
      global.s3,
      global.s4,
      global.s5
    ])
}
