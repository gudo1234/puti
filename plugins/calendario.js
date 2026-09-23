import { createCanvas } from '@napi-rs/canvas'
import moment from 'moment-timezone'
import PhoneNum from 'awesome-phonenumber'

const banderaEmoji = (countryCode) => {
  if (!countryCode || countryCode.length !== 2) return ''
  const codePoints = [...countryCode.toUpperCase()].map(
    c => 0x1F1E6 + c.charCodeAt(0) - 65
  )
  return String.fromCodePoint(...codePoints)
}

const regionNames = new Intl.DisplayNames(['es'], { type: 'region' })

let handler = async (m, { conn }) => {
  try {
    const number = m.sender.split('@')[0]
    const phoneInfo = PhoneNum('+' + number)
    const countryCode = phoneInfo.getRegionCode('international')
    const country = regionNames.of(countryCode) || 'Desconocido'
    const flag = banderaEmoji(countryCode)

    const tz = 'America/Tegucigalpa'
    const today = moment().tz(tz)

    const month = today.format('MMMM')
    const year = today.format('YYYY')
    const currentDay = today.date()
    const startOfMonth = today.clone().startOf('month')
    const daysInMonth = today.daysInMonth()
    const startDay = startOfMonth.day()

    const width = 800
    const height = 700
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    /* ───── ESTILOS ───── */
    function estiloDegradado() {
      const g = ctx.createLinearGradient(0, 0, 0, height)
      g.addColorStop(0, '#4facfe')
      g.addColorStop(1, '#00f2fe')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, width, height)
    }

    function estiloOscuro() {
      ctx.fillStyle = '#111'
      ctx.fillRect(0, 0, width, height)
    }

    function estiloPastel() {
      ctx.fillStyle = '#ffe0f0'
      ctx.fillRect(0, 0, width, height)
    }

    function estiloGalaxia() {
      ctx.fillStyle = '#0b0033'
      ctx.fillRect(0, 0, width, height)
      for (let i = 0; i < 100; i++) {
        ctx.beginPath()
        ctx.arc(
          Math.random() * width,
          Math.random() * height,
          Math.random() * 2 + 1,
          0,
          Math.PI * 2
        )
        ctx.fillStyle = `rgba(255,255,255,${Math.random()})`
        ctx.fill()
      }
    }

    function estiloRetro() {
      ctx.fillStyle = '#fef5c4'
      ctx.fillRect(0, 0, width, height)
      ctx.strokeStyle = '#000'
      for (let i = 0; i < height; i += 40) {
        ctx.beginPath()
        ctx.moveTo(0, i)
        ctx.lineTo(width, i)
        ctx.stroke()
      }
    }

    const styles = [
      estiloDegradado,
      estiloOscuro,
      estiloPastel,
      estiloGalaxia,
      estiloRetro
    ]

    styles[Math.floor(Math.random() * styles.length)]()

    renderCalendarioBase(
      ctx,
      width,
      month,
      year,
      daysInMonth,
      startDay,
      currentDay
    )

    ctx.fillStyle = '#fff'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`País: ${country} ${flag}`, 40, height - 40)

    const buffer = canvas.toBuffer('image/png')

    
       let txt = `🗓 *Calendario de ${month.charAt(0).toUpperCase() + month.slice(1)} ${year}*`
    await conn.sendFile(m.chat, buffer, 'image.jpg', txt, m, null, rcanal);

  } catch (e) {
    console.error(e)
    return m.reply(`❌ Error al generar el calendario:\n${e.message}`)
  }
}

handler.help = ['calendario']
handler.tags = ['herramientas']
handler.command = ['calendario', 'calendar', 'mes']
handler.group = true

export default handler

/* ───── RENDER CALENDARIO ───── */
function renderCalendarioBase(ctx, width, month, year, daysInMonth, startDay, currentDay) {
  ctx.fillStyle = '#fff'
  ctx.font = 'bold 36px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${month.charAt(0).toUpperCase() + month.slice(1)} ${year}`, width / 2, 70)

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  ctx.font = 'bold 22px sans-serif'

  days.forEach((d, i) => {
    ctx.fillStyle = '#ffffff99'
    ctx.fillRect(80 + i * 90, 100, 70, 40)
    ctx.fillStyle = '#000'
    ctx.fillText(d, 115 + i * 90, 130)
  })

  ctx.font = '22px sans-serif'
  let x = 80 + startDay * 90
  let y = 160

  for (let i = 1; i <= daysInMonth; i++) {
    if ((i + startDay - 1) % 7 === 0 && i !== 1) {
      y += 60
      x = 80
    }

    if (i === currentDay) {
      ctx.beginPath()
      ctx.arc(x + 35, y + 25, 28, 0, Math.PI * 2)
      ctx.fillStyle = '#ff4081'
      ctx.shadowColor = '#ff4081'
      ctx.shadowBlur = 15
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#fff'
    } else {
      ctx.fillStyle = '#ffffffaa'
      ctx.fillRect(x, y, 70, 50)
      ctx.fillStyle = '#000'
    }

    ctx.textAlign = 'center'
    ctx.fillText(i.toString(), x + 35, y + 35)
    x += 90
  }
      }
