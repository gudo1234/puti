import axios from 'axios'

class ReactChannel {
  constructor(config) {
    this.userJwt = config.userJwt
    this.siteKey = '6LemKk8sAAAAAH5PB3f1EspbMlXjtwv5C8tiMHSm'
    this.backendUrl = 'https://back.asitha.top/api'

    this.http = axios.create({
      headers: {
        'Content-Type': 'application/json',
        Authorization: Bearer ${this.userJwt}
      },
      timeout: 30000
    })
  }

  async getRecaptchaToken() {
    // Updated to use the new endpoint provided
    const { data } = await axios.get(
      'https://omegatech-api.dixonomega.tech/api/tools/recaptcha-v3',
      {
        params: {
          sitekey: this.siteKey,
          url: 'https://back.asitha.top/api',
          use_enterprise: 'false'
        }
      }
    )

    if (!data?.success || !data?.token) {
      throw new Error('Recaptcha bypass failed: ' + (data?.message || 'No token returned'))
    }

    return data.token
  }

  async getTempApiKey(token) {
    const { data } = await this.http.post(
      ${this.backendUrl}/user/get-temp-token,
      { recaptcha_token: token }
    )

    if (!data?.token) throw new Error('Temp API key failed')

    return data.token
  }

  async reactToPost(postLink, reacts) {
    const recaptcha = await this.getRecaptchaToken()
    const tempKey = await this.getTempApiKey(recaptcha)

    const { data } = await this.http.post(
      ${this.backendUrl}/channel/react-to-post?apiKey=${tempKey},
      {
        post_link: postLink,
        reacts
      }
    )

    return data
  }
}

let handler = async (m, { args, usedPrefix, command }) => {

  if (!args[0]) {
    return m.reply(
⚡ Usage:
${usedPrefix + command} <link> <emoji1,emoji2>

Example:
${usedPrefix + command} https://whatsapp.com/channel/xxx 😭,🔥
    )
  }

  await m.react('🕒')

  try {
    const input = args.join(' ')
    const [postLink, ...emojiParts] = input.split(' ')
    const reactsRaw = emojiParts.join(' ')

    if (!postLink || !reactsRaw)
      return m.reply('❌ Invalid format.')

    if (!postLink.includes('whatsapp.com/channel/'))
      return m.reply('❌ Invalid WhatsApp channel link.')

    const emojis = reactsRaw
      .split(',')
      .map(e => e.trim())
      .filter(Boolean)

    if (!emojis.length)
      return m.reply('❌ No emojis provided.')

    if (emojis.length > 4)
      return m.reply('❌ Max 4 emojis allowed.')

    const client = new ReactChannel({
      userJwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5OGE2ZGI5MjVjMzUyOTcxZTIyYTdkNSIsImlhdCI6MTc3NTg1NzUyMCwiZXhwIjoxNzc2NDYyMzIwfQ.q7D6potY6cl3n-ZY8nQbetNFqPSl79aF5IIZ_QbtABc'
    })

    await client.reactToPost(postLink, emojis.join(','))

    await m.react('✅')
    m.reply('🔥 Reactions sent successfully.')

  } catch (e) {
    console.error('React Error:', e.response?.data || e.message)
    await m.react('❌')
    m.reply(❌ Failed: ${e.response?.data?.message || e.message})
  }
}

handler.help = ['rch <link> <emoji,emoji>']
handler.tags = ['tools']
handler.command = ["rch", "reactch"]

export default handler
