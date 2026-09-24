import { delay, prepareWAMessageMedia } from '@whiskeysockets/baileys'

const urls = [
  'https://cdn.ornzora.eu.cc/aed35b3f-baf5-4c2e-9839-1a1188c5c44a-FIORA.jpg',
  'https://cdn.ornzora.eu.cc/4930f428-6661-4c17-a52c-2d48eff2f86d-FIORA.jpg',
  'https://cdn.ornzora.eu.cc/d4443125-d672-4034-972c-04b73969b359-FIORA.jpg',
  'https://cdn.ornzora.eu.cc/59f8c79a-8274-4d61-a200-ea4a279b9e5d-FIORA.jpg',
  'https://cdn.ornzora.eu.cc/090f9baf-aaeb-4c79-8995-b3b541cef444-FIORA.jpg'
]

let handler = async (m, { conn }) => {

const { key } = await conn.sendMessage(
m.chat,
{ text: '☠ X E O N H A C K M O D E ☠' },
{ quoted: m }
)

const hawemod = [
'☠ X E O N   C Y B E R   T E R M I N A L ☠',
'[■□□□□□□□□□] 10%  > Initializing exploit modules...',
'[■■□□□□□□□□] 20%  > Scanning target device ports...',
'[■■■□□□□□□□] 30%  > Reading encrypted packets...',
'[■■■■□□□□□□] 40%  > Injecting remote payload...',
'[■■■■■□□□□□] 50%  > Bypassing firewall protection...',
'[■■■■■■□□□□] 60%  > Accessing private directories...',
'[■■■■■■■□□□] 70%  > Dumping session tokens...',
'[■■■■■■■■□□] 80%  > Reading hidden database...',
'[■■■■■■■■■□] 90%  > Extracting device metadata...',
'[■■■■■■■■■■] 100% > Root access granted',
'☠ HACKING COMPLETED ☠'
]

const link = 'https://gta5-store.vercel.app/'
const title = 'Nixel'
const description = '© 2take1-interative'

const medias = await Promise.all(
urls.map(async url => {
const { imageMessage } = await prepareWAMessageMedia(
{ image: { url } },
{
upload: conn.waUploadToServer,
mediaTypeOverride: 'thumbnail-link'
}
)

return imageMessage
})
)

let imgIndex = 0

for (let i = 0; i < hawemod.length; i++) {

const image = medias[imgIndex]

await conn.sendMessage(m.chat, {
edit: key,
text: `${link}\n${hawemod[i]}`,
linkPreview: {
'matched-text': link,
title,
description,
jpegThumbnail: image.jpegThumbnail,
highQualityThumbnail: image
},
contextInfo: {
mentionedJid: [m.sender],
groupMentions: [],
statusAttributions: [],
stanzaId: "FAKE_META_ID_001",
participant: "13135550002@s.whatsapp.net",
quotedMessage: {
contactMessage: {
displayName: "Meta AI: \n ¡𝘈𝘲𝘶𝘪 𝘦𝘴𝘵𝘢 𝘵𝘶 𝘉𝘶𝘴𝘲𝘶𝘦𝘥𝘢! 😏",
vcard: `BEGIN:VCARD\nVERSION:3.0\nN;CHARSET=UTF-8:;Meta AI;;;;\nFN;CHARSET=UTF-8:Meta AI\nTEL;waid=13135550002:+1 313 555 0002\nEND:VCARD`
}
},
remoteJid: "@broadcast",
forwardingScore: 10,
isForwarded: true,
forwardedNewsletterMessageInfo: {
newsletterJid: "120363419951364623@newsletter",
serverMessageId: 1,
newsletterName: "2take1-Interative"
}
}
})

imgIndex++
if (imgIndex >= medias.length) imgIndex = 0

await delay(1000)
}
}

handler.help = ['xeon']
handler.tags = ['fun']
handler.command = ['king']

export default handler
