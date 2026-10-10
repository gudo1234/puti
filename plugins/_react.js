import axios from 'axios'

class ReactChannel {
constructor(config) {
this.userJwt = config.userJwt
this.siteKey = '6LemKk8sAAAAAH5PB3f1EspbMlXjtwv5C8tiMHSm'
this.backendUrl = 'https://back.asitha.top/api'

this.http = axios.create({
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${this.userJwt}`
  },
  timeout: 30000
})

}

async getRecaptchaToken() {
const { data } = await axios.get(
'https://omegatech-api.dixonomega.tech/api/tools/recaptcha-v3',
{
params: {
sitekey: this.siteKey,
url: 'https://back.asitha.top/api',
use_enterprise: 'false'
},
timeout: 30000
}
)

if (!data?.success || !data?.token) {
  throw new Error(
    data?.message || 'No se pudo obtener el token de reCAPTCHA'
  )
}

return data.token

}

async getTempApiKey(token) {
const { data } = await this.http.post(
"${this.backendUrl}/user/get-temp-token",
{ recaptcha_token: token }
)

if (!data?.token) {
  throw new Error(
    data?.message || 'No se pudo obtener la clave temporal de la API'
  )
}

return data.token

}

async reactToPost(postLink, reacts) {
const recaptcha = await this.getRecaptchaToken()
const tempKey = await this.getTempApiKey(recaptcha)

const { data } = await this.http.post(
  `${this.backendUrl}/channel/react-to-post`,
  {
    post_link: postLink,
    reacts
  },
  {
    params: {
      apiKey: tempKey
    }
  }
)

return data

}
}

let handler = async (m, { args, usedPrefix, command }) => {
if (!args[0]) {
return m.reply(
`⚡ Uso:
${usedPrefix + command} <link> <emoji1,emoji2>

Ejemplo:
${usedPrefix + command} https://whatsapp.com/channel/xxx 😭,🔥`
)
}

await m.react('🕒')

try {
const input = args.join(' ').trim()
const [postLink, ...emojiParts] = input.split(/\s+/)
const reactsRaw = emojiParts.join(' ')

if (!postLink || !reactsRaw) {
  throw new Error('Formato inválido. Proporciona el enlace y los emojis.')
}

if (!/^https?:\/\/(www\.)?whatsapp\.com\/channel\/[^\s]+$/i.test(postLink)) {
  throw new Error('El enlace del canal de WhatsApp no es válido.')
}

const emojis = reactsRaw
  .split(',')
  .map(e => e.trim())
  .filter(Boolean)

if (!emojis.length) {
  throw new Error('No proporcionaste ningún emoji.')
}

if (emojis.length > 4) {
  throw new Error('Solo puedes utilizar un máximo de 4 emojis.')
}

const userJwt = process.env.REACT_CHANNEL_JWT

if (!userJwt) {
  throw new Error('Falta configurar la variable REACT_CHANNEL_JWT.')
}

const client = new ReactChannel({ userJwt })

const result = await client.reactToPost(
  postLink,
  emojis.join(',')
)

await m.react('✅')

return m.reply(
  `🔥 Solicitud procesada.\n\nRespuesta: ${JSON.stringify(result)}`
)

} catch (e) {
const errorData = e.response?.data

const error =
  errorData?.message ||
  errorData?.error ||
  (typeof errorData === 'string' ? errorData : null) ||
  e.message ||
  'Error desconocido'

console.error(
  'React Error:',
  errorData || e.stack || e.message
)

await m.react('❌')

return m.reply(`❌ Error: ${error}`)

}
}

handler.help = ['rch <link> <emoji,emoji>']
handler.tags = ['tools']
handler.command = ['rch', 'reactch']

export default handler
