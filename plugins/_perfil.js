import axios from 'axios'
import PhoneNum from 'awesome-phonenumber'
import moment from 'moment-timezone'
import { getDevice } from '@whiskeysockets/baileys'
import 'moment/locale/es.js'

moment.locale('es')
const regionNames = new Intl.DisplayNames(['es'], { type: 'region' })

function banderaEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return ''
  const codePoints = [...countryCode.toUpperCase()].map(char => 0x1F1E6 + char.charCodeAt(0) - 65)
  return String.fromCodePoint(...codePoints)
}

const handler = async (m, { conn, usedPrefix, command, text }) => {
  try {
    // ======== DETECTAR USUARIO OBJETIVO ==========
    let target
    let own = false

    if (m.quoted?.sender) {
      target = m.quoted.sender
    } else if (m.mentionedJid?.[0]) {
      target = m.mentionedJid[0]
    } else if (text) {
      const clean = text.replace(/\D/g, '')
      target = clean ? `${clean}@s.whatsapp.net` : m.sender
    } else {
      target = m.sender
      own = true
    }

    // ======== VALIDAR EXISTENCIA ==========
    const exists = await conn.onWhatsApp(target)
    if (!exists[0]?.exists) throw '❌ Este usuario no existe o no está registrado en WhatsApp.'

    // ======== DATOS BÁSICOS ==========
    const number = target.split('@')[0]
    const name = await conn.getName(target)
    const phoneInfo = PhoneNum('+' + number)
    const countryCode = phoneInfo.getRegionCode('international')
    const country = regionNames.of(countryCode) || 'Desconocido'
    const flag = banderaEmoji(countryCode)
    const formatNum = phoneInfo.getNumber('international')
    const url = 'https://wa.me/' + number

    // ======== DATOS DE PAÍS ==========
    let capital = 'Desconocida'
    let fechaLocal = 'No disponible'
    let extraInfo = ''

    try {
      const dorratz = await axios.get(`https://api.dorratz.com/v2/pais/+${number.substring(0, 3)}`)
      const data = dorratz.data

      capital = data.capital || 'Desconocida'
      extraInfo += `🌍 *Continente:* ${data.continente || '-'}\n`
      extraInfo += `💰 *Moneda:* ${data.moneda || '-'}\n`
      extraInfo += `🌡️ *Clima:* ${data.clima || '-'}\n`
      extraInfo += `🏙️ *Población:* ${data.población || '-'}\n`
      extraInfo += `📦 *Economía:* ${data.economía || '-'}\n`
      extraInfo += `🎉 *Fiesta nacional:* ${data.fiesta_nacional || '-'}\n`
      extraInfo += `🗣️ *Idioma:* ${data.idioma_oficial || '-'}\n`
      extraInfo += `🍽️ *Gastronomía:* ${data.gastronomía || '-'}\n`

      // ======== CLIMA ACTUAL ==========
      try {
        const climaRes = await axios.get(`https://api.dorratz.com/v2/clima-s?city=${encodeURIComponent(data.capital || data.nombre)}`)
        const clima = climaRes.data
        extraInfo += `\n☁️ _*ᴄʟɪᴍᴀ ᴀᴄᴛᴜᴀʟ:*_\n`
        extraInfo += `- Estado: ${clima.weather || '-'}\n`
        extraInfo += `- Temperatura: ${clima.temperature || '-'}\n`
        extraInfo += `- Temp. mínima: ${clima.minimumTemperature || '-'}\n`
        extraInfo += `- Temp. máxima: ${clima.maximumTemperature || '-'}\n`
        extraInfo += `- Humedad: ${clima.humidity || '-'}\n`
        extraInfo += `- Viento: ${clima.wind || '-'}\n`
      } catch {
        extraInfo += `\n☁️ _*ᴄʟɪᴍᴀ ᴀᴄᴛᴜᴀʟ:*_ No disponible\n`
      }

      fechaLocal = moment().tz('America/Tegucigalpa').format('dddd, D [de] MMMM [de] YYYY')
    } catch {
      // ======== FALLBACK: RESTCOUNTRIES ==========
      try {
        const res = await axios.get(`https://restcountries.com/v3.1/alpha/${countryCode}`)
        const data = res.data[0]
        capital = data.capital?.[0] || 'Desconocida'
        const zona = data.timezones?.[0]
        if (zona) fechaLocal = moment().tz(zona).format('dddd, D [de] MMMM [de] YYYY')
      } catch (e) {
        console.error('Error obteniendo datos del país:', e)
      }
    }

    // ======== DATOS DE PERFIL ==========
    const img = await conn.profilePictureUrl(target, 'image').catch(_ => icono)
    const bio = await conn.fetchStatus(target).catch(_ => null)
    const business = await conn.getBusinessProfile(target).catch(_ => null)

    let caption = `🔥 _*ɪɴғᴏʀᴍᴀᴄɪᴏɴ ᴅᴇʟ ᴜsᴜᴀʀɪᴏ*_\n\n`
    caption += `👤 *Nombre:* ${name || '-'}\n`
    caption += `📱 *Número:* ${formatNum}\n`
    caption += `🌎 *País:* ${country} ${flag}\n`
    caption += `🏛️ *Capital:* ${capital}\n`
    caption += `📅 *Fecha local:* ${fechaLocal}\n`
    caption += `🔗 *Enlace:* ${url}\n`
    caption += `🏷️ *Tag:* @${number}\n`
    caption += `💬 *Bio:* ${bio?.status || '-'}\n`
    caption += `🕓 *Actualizado:* ${bio?.setAt ? moment(bio.setAt).format('LLLL') : '-'}\n`
    caption += `📲 *Dispositivo:* ${own ? getDevice(m.key.id) : '-'}\n`
    caption += extraInfo

    if (business) {
      caption += `\n⚡ _*ᴄᴜᴇɴᴛᴀ ᴡᴀ/ʙᴜsɪɴᴇss*_\n`
      caption += `🆔 *ID:* ${business.wid}\n`
      caption += `🌐 *Sitio Web:* ${business.website || '-'}\n`
      caption += `📧 *Email:* ${business.email || '-'}\n`
      caption += `🏢 *Categoría:* ${business.category || '-'}\n`
      caption += `📍 *Dirección:* ${business.address || '-'}\n`
      caption += `🕒 *Zona horaria:* ${business.business_hours?.timezone || '-'}\n`
      caption += `📝 *Descripción:* ${business.description || '-'}\n`
    }

    await m.react('🔥')
    await conn.sendMessage(m.chat, {
      image: { url: img },
      caption,
      mentions: [target]
    }, { quoted: m })
  } catch (err) {
    console.error(err)
    await m.reply(`${e} _Para obtener la información, responda al mensaje del usuario o ingrese su número con código de país, por ejemplo: *${usedPrefix + command}* +504XXXXXXXX_`)
  }
}

handler.help = ["perfil"]
handler.tags = ["buscador"]
handler.command = ['wastalk', 'perfil', 'ava', 'profile']
handler.group = true
export default handler
