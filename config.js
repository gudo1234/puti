import { watchFile, unwatchFile } from 'fs' 
import chalk from 'chalk'
import { fileURLToPath } from 'url'
import fs from 'fs'
import cheerio from 'cheerio'
import fetch from 'node-fetch'
import axios from 'axios'



global.owner = [
   ['50492280729', '🪐 ݁𝆹𝅥𐙚˖ܵʑєܲυsܵ˖݁𝆹𝅥˃͈◡˂͈', true],
   ['5215539356057'], ['5215547835230']];

global.mods = []
global.prems = []
global.jadi = 'JadiBots' 
global.yukiJadibts = true
//❤️❤️❤️❤️
const emojiList = [
    "🌱", "🪴", "⭐", "🍁", "⚡",
    "🌙", "🏖️", "🪐", "✨", "🌊"
];

const redesList = [
    "https://whatsapp.com/channel/0029VaXHNMZL7UVTeseuqw3H",
    "https://wa.me/50492280729?text=Hola+quiero+un+bot+para+mi+grupo,+cuáles+son+los+planes?+",
    "https://www.instagram.com/edi504_?",
    "https://www.tiktok.com/@edar_xd",
    "https://www.paypal.me/edar504",
    "https://chat.whatsapp.com/EGWREmKYGUAADNAan5vxZo?mode=wwt"
];

const iconosList = [
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me2.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me3.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me4.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me5.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me6.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me7.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me8.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me9.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me10.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me11.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me12.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me13.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me14.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me15.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me16.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me17.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me18.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me19.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me20.jpg',
    'https://raw.githubusercontent.com/CheirZ/Repo-img/main/zeus-jpeg/me21.jpg',
    'https://raw.githubusercontent.com/edar123/im/main/media/me22.jpg'
];

const cell = ['https://raw.githubusercontent.com/edar123/im/main/media/me23.jpg', 'https://raw.githubusercontent.com/edar123/im/main/media/me23.jpg']
global.imagen7 = null
global.imagen8 = null

global.channelRD ||= {
  id: "120363285614743024@newsletter",
  name: "🤖⃧►iʑυвöτ◃2.0▹"
}

global.rcanal ||= {
  contextInfo: {
    forwardedNewsletterMessageInfo: {
      newsletterJid: global.channelRD.id,
      newsletterName: global.channelRD.name,
      serverMessageId: -1
    }
  }
}

async function cargarImagenesGlobales() {
  try {
    const r1 = await fetch('https://raw.githubusercontent.com/edar123/im/main/media/ad.png')
    if (r1.ok) global.imagen7 = Buffer.from(await r1.arrayBuffer())
  } catch (error) {
    console.warn('[config] No se pudo cargar imagen7:', error?.message || error)
  }

  try {
    const r2 = await fetch('https://raw.githubusercontent.com/edar123/im/main/media/byenavidad.jpg')
    if (r2.ok) global.imagen8 = Buffer.from(await r2.arrayBuffer())
  } catch (error) {
    console.warn('[config] No se pudo cargar imagen8:', error?.message || error)
  }
}

cargarImagenesGlobales().catch(error => console.warn('[config] carga de imágenes:', error?.message || error))
Object.defineProperty(global, "e", {
    get() {
        return emojiList[Math.floor(Math.random() * emojiList.length)];
    }
});

Object.defineProperty(global, "redes", {
    get() {
        return redesList[Math.floor(Math.random() * redesList.length)];
    }
});

Object.defineProperty(global, "icono", {
    get() {
        return iconosList[Math.floor(Math.random() * iconosList.length)];
    }
});
//📱
Object.defineProperty(global, "cel", {
    get() {
        return cell[Math.floor(Math.random() * cell.length)];
    }
});
//📱

global.a1 = `╭┈۫۫۫۫۫╌۪۪۪۪۪۪۪۪֠╼◈¨(`
global.a2 = `)¨◈۫۫۫۫۫۫۫۫۫╾֩┈۪۪۪۪╮`
global.ch = {
ch1: "120363401404146384@newsletter"
}
//✅✅✅✅

global.packname = "🤖⃧►iʑυвöτ◃2.0▹"
global.textbot = "Bot de mierd4";
global.author = "🪐 ݁𝆹𝅥𐙚˖ܵʑєܲυsܵ˖݁𝆹𝅥˃͈◡˂͈";
global.wm = "🤖⃧►iʑυвöτ◃2.0▹"
global.wait = 'Espera Por Favot'
global.botname = '🤖⃧►iʑυвöτ◃2.0▹'
global.listo = 'Se completo tarea'
global.namechannel = '🤖⃧►iʑυвöτ◃2.0▹'

global.grupo = 'https://chat.whatsapp.com/EGWREmKYGUAADNAan5vxZo?mode=wwt'
global.canal = 'https://whatsapp.com/channel/0029VaXHNMZL7UVTeseuqw3H'

global.cheerio = cheerio
global.fs = fs
global.fetch = fetch
global.axios = axios

global.multiplier = 69 
global.maxwarn = '2' // m谩xima advertencias

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'main.js'"))
  import(`${file}?update=${Date.now()}`)
})

              
