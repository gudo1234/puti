import fs from 'fs'
import { join } from 'path'
import sharp from 'sharp'
import fetch from 'node-fetch'
import { getDevice } from "@whiskeysockets/baileys"

let handler = async (m, { conn, usedPrefix, __dirname }) => {
let groupName = ''
if (m.isGroup) {
    const metadata = await conn.groupMetadata(m.chat)
    groupName = metadata.subject
}

  try {
    // --- Imagen miniatura ---
    const imgPath = join(__dirname, '../storage/catalogo.jpg')
    const thumbLocal = fs.existsSync(imgPath) ? fs.readFileSync(imgPath) : null
    const thumbResized = thumbLocal
      ? await sharp(thumbLocal).resize(300, 100, { fit: 'cover' }).jpeg().toBuffer()
      : null

    // --- Menú simple ---
    let uptime = process.uptime() * 1000
  let run = clockString(uptime)
    const info = await global.mundo(m, conn)
    let categorias = {}

    for (const plugin of Object.values(global.plugins)) {
        const h = plugin.default || plugin
        if (!h || !h.help || !h.tags) continue

        const helps = Array.isArray(h.help) ? h.help : [h.help]
        const tags = Array.isArray(h.tags) ? h.tags : [h.tags]

        for (const tag of tags) {
            if (!categorias[tag]) categorias[tag] = []
            categorias[tag].push(...helps)
        }
    }

      m.react(e)
let pais = `${info.flag} ${info.country}`
    let text = `${e} _Hola ${m.pushName}_ ¿Cómo estás?\n\n\`❒ᴄᴏɴᴛᴇxᴛ-ɪɴғᴏ☔\`
┌────────────
│ 🌎 *País:* ${pais}
│ 📱 *Sistema/Opr:* ${getDevice(m.key.id)}
└────────────\n\n🤖 *MENÚ DE COMANDOS*\n━━━━━━━━━━━━━━\n`

    for (const tag of Object.keys(categorias).sort()) {
        text += `\n╭─❏ *${tag.toUpperCase()}*\n`
        for (const cmd of [...new Set(categorias[tag])]) {
            text += `│ • ${usedPrefix}${cmd}\n`
        }
        text += `╰────────────\n`
    }

    // --- Estructura del mensaje interactivo ---
    const nativeFlowPayload = {
      header: {
        documentMessage: {
          url: 'https://mmg.whatsapp.net/v/t62.7119-24/539012045_745537058346694_1512031191239726227_n.enc',
          mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          fileSha256: Buffer.from('fa09afbc207a724252bae1b764ecc7b13060440ba47a3bf59e77f01924924bfe', 'hex'),
          fileLength: { low: -727379969, high: 232, unsigned: true },
          pageCount: 0,
          mediaKey: Buffer.from('3163ba7c8db6dd363c4f48bda2735cc0d0413e57567f0a758f514f282889173c', 'hex'),
          fileName: 'Bot- AI WhatsApp',
          fileEncSha256: Buffer.from('652f2ff6d8a8dae9f5c9654e386de5c01c623fe98d81a28f63dfb0979a44a22f', 'hex'),
          directPath: '/v/t62.7119-24/539012045_745537058346694_1512031191239726227_n.enc',
          mediaKeyTimestamp: { low: 1756370084, high: 0, unsigned: false },
          jpegThumbnail: thumbResized || null
        },
        hasMediaAttachment: true
      },
      body: { text: text },
      footer: { text: '🤨 xvidẹ𝆬os.er/k (๑ ิټ ิ)' },
      nativeFlowMessage: {
        buttons: [
          { name: 'single_select', buttonParamsJson: '{"has_multiple_buttons":true}' },
          { name: 'call_permission_request', buttonParamsJson: '{"has_multiple_buttons":true}' },
          {
            name: 'single_select',
            buttonParamsJson: `{
              "title":"Más Opciones",
              "sections":[
                {
                  "title":"⌏Seleccione una opción requerida⌎",
                  "highlight_label":"Desarrollador",
                  "rows":[
                    {"title":"Owner/Creador","description":"","id":"Edar"},
                    {"title":"Información del Bot","description":"","id":".info"},
                    {"title":"Reglas/Términos","description":"","id":".reglas"},
                    {"title":"Ping","description":"Velocidad del bot","id":".ping"}
                  ]
                }
              ],
              "has_multiple_buttons":true
            }`
          },
          { name: 'cta_copy', buttonParamsJson: '{"display_text":"Copiar Código","id":"123456789","copy_code":"Soy bien puto alv :v"}' },
          {
            name: 'cta_url',
            buttonParamsJson: `{"display_text":"Canal de WhatsApp","url":"https://whatsapp.com/channel/0029VaXHNMZL7UVTeseuqw3H","merchant_url":"https://whatsapp.com/channel/0029VaXHNMZL7UVTeseuqw3H"}`
          },
          {
            name: 'galaxy_message',
            buttonParamsJson: `{
              "mode":"published",
              "flow_message_version":"3",
              "flow_token":"1:1307913409923914:293680f87029f5a13d1ec5e35e718af3",
              "flow_id":"1307913409923914",
              "flow_cta":"👨🏻‍💻 ᴀᴄᴄᴇᴅᴇ ᴀ ʙᴏᴛ ᴀɪ",
              "flow_action":"navigate",
              "flow_action_payload":{
                "screen":"QUESTION_ONE",
                "params":{"user_id":"123456789","referral":"campaign_xyz"}
              },
              "flow_metadata":{
                "flow_json_version":"201",
                "data_api_protocol":"v2",
                "flow_name":"Lead Qualification [en]",
                "data_api_version":"v2",
                "categories":["Lead Generation","Sales"]
              }
            }`
          }
        ],
        messageParamsJson: `{
          "limited_time_offer":{
            "text":"🕒 Runtime ${run}",
            "url":"https://github.com/edar",
            "copy_code":"${groupName}",
            "expiration_time":1754613436864329
          },
          "bottom_sheet":{
            "in_thread_buttons_limit":2,
            "divider_indices":[1,2,3,4,5,999],
            "list_title":"Select Menu",
            "button_title":"▻ Lista menú 📘"
          },
          "tap_target_configuration":{
            "title":"▸ X ◂",
            "description":"Let’s go",
            "canonical_url":"https://github.com/edar",
            "domain":"https://xrljosedvapi.vercel.app",
            "button_index":0
          }
        }`
      }
    }

    // --- Envío del mensaje ---
      const thumbnail = await (await fetch(icono)).buffer()
        const random = Math.floor(Math.random() * 3);
        const gif = [
  "https://raw.githubusercontent.com/edar123/im/main/media/gif.mp4",
  "https://raw.githubusercontent.com/edar123/im/main/media/giff.mp4",
  "https://raw.githubusercontent.com/edar123/im/main/media/gifff.mp4",
  "https://raw.githubusercontent.com/edar123/im/main/media/gif4.mp4"
][Math.floor(Math.random() * 4)];

      if (random === 0) {
        await conn.sendMessage(
    m.chat,
    {
        text: text
    },
    { quoted: m }
)
        return;
      }

      if (random === 1) {
      await conn.sendMessage(m.chat, {
      video: { url: gif },
      gifPlayback: true,
      caption: text,
      mentions: [m.sender]
    }, { quoted: m })
    return;
  }

  if (random === 2) {
      //😈
    await conn.relayMessage(
      m.chat,
      { viewOnceMessage: { message: { interactiveMessage: nativeFlowPayload } } },
      { quoted: m }
    )
  }
  } catch (e) {
    console.error('Error al generar mensaje interactivo:', e)
    await conn.reply(m.chat, `❌ Error al generar mensaje:\n${e.message}`, m)
  }
}

function clockString(ms) {
  let h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
  let m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
  let s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}

handler.help = ['menu']
handler.tags = ['main']
handler.group = true;
handler.command = ['menu', 'help', 'comandos', 'menú', 'm', 'memu']
export default handler
