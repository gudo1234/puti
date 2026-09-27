let WAMessageStubType = (await import('@whiskeysockets/baileys')).default
const { default: PhoneNumber } = await import('awesome-phonenumber')

const regionNames = new Intl.DisplayNames(['es'], {
  type: 'region'
})

const banderaEmoji = c =>
  !c || c.length !== 2
    ? '🌐'
    : [...c.toUpperCase()]
        .map(x =>
          String.fromCodePoint(
            0x1F1E6 - 65 + x.charCodeAt(0)
          )
        )
        .join('')

let handler = m => m

handler.before = async function (m, { conn, participants }) {
  try {
    if (!m?.isGroup) return
    if (![29, 30].includes(m.messageStubType)) return

    const chat = global?.db?.data?.chats?.[m.chat]
    if (!chat?.detect) return

    const safe = v =>
      typeof v === 'string' ? v : ''

    const first = jid =>
      safe(jid).split('@')[0]

    /*
     * Busca un participante por su JID/LID.
     */
    const buscarParticipante = jid => {
      const id =
        typeof jid === 'object'
          ? jid?.id
          : jid

      if (!id) return null

      return (
        participants?.find(p =>
          p?.id === id ||
          p?.jid === id ||
          p?.phoneNumber === id
        ) ||

        participants?.find(p => {
          const a =
            safe(p?.id).split('@')[0]

          const b =
            safe(p?.jid).split('@')[0]

          const c =
            safe(p?.phoneNumber)

          const x =
            safe(id).split('@')[0]

          return (
            x &&
            (
              x === a ||
              x === b ||
              x === c
            )
          )
        }) ||

        null
      )
    }

    /*
     * Actor original.
     *
     * IMPORTANTE:
     * Se conserva el @lid original para la mención.
     */
    const actor =
      m?.sender ||
      m?.key?.participant ||
      m?.participant ||
      ''

    /*
     * El target puede venir como:
     *
     * "94880555879752@lid"
     *
     * o como:
     *
     * {
     *   id: "94880555879752@lid",
     *   phoneNumber: "50488723207"
     * }
     */
    const targetData =
      m?.messageStubParameters?.[0]

    if (!targetData) return

    const target =
      typeof targetData === 'object'
        ? (
            targetData?.id ||
            targetData?.jid ||
            ''
          )
        : targetData

    if (!target) return

    /*
     * Buscamos la información completa.
     */
    const actorParticipant =
      buscarParticipante(actor)

    const targetParticipant =
      buscarParticipante(targetData)

    /*
     * Número real del ACTOR.
     *
     * Primero intentamos phoneNumber.
     */
    const actorPhone =
      actorParticipant?.phoneNumber ||
      actorParticipant?.pn ||
      ''

    /*
     * Número real del TARGET.
     *
     * El propio evento puede traerlo directamente.
     */
    const targetPhone =
      (
        typeof targetData === 'object'
          ? (
              targetData?.phoneNumber ||
              targetData?.pn ||
              ''
            )
          : ''
      ) ||

      targetParticipant?.phoneNumber ||
      targetParticipant?.pn ||
      ''

    /*
     * Formatear número.
     */
    const formatearNumero = numero => {
      const limpio =
        safe(numero)
          .replace(/\D/g, '')

      return limpio
        ? '+' + limpio
        : 'Desconocido'
    }

    const actorNumber =
      formatearNumero(actorPhone)

    const targetNumber =
      formatearNumero(targetPhone)

    /*
     * País.
     */
    const obtenerPais = numero => {
      try {
        const limpio =
          safe(numero)
            .replace(/\D/g, '')

        if (!limpio) {
          return {
            pais: 'Desconocido',
            bandera: '🌐'
          }
        }

        const pn =
          new PhoneNumber('+' + limpio)

        const code =
          pn.getRegionCode() || '??'

        return {
          pais:
            code !== '??'
              ? regionNames.of(code) || 'Desconocido'
              : 'Desconocido',

          bandera:
            banderaEmoji(code)
        }

      } catch {
        return {
          pais: 'Desconocido',
          bandera: '🌐'
        }
      }
    }

    const actorInfo =
      obtenerPais(actorNumber)

    const targetInfo =
      obtenerPais(targetNumber)

    /*
     * Administradores.
     *
     * Aquí NO convertimos los JID.
     * Conservamos exactamente p.id,
     * porque esa es la forma que ya
     * comprobaste que funciona.
     */
    const adminJids =
      (participants || [])
        .filter(p =>
          p?.admin === 'admin' ||
          p?.admin === 'superadmin'
        )
        .map(p => p?.id)
        .filter(Boolean)

    /*
     * Menciones originales.
     *
     * NO convertir @lid.
     */
    const mentions =
      Array.from(
        new Set([
          ...adminJids,
          actor,
          target
        ].filter(Boolean))
      )

    /*
     * HIZO ADMIN
     */
    if (m.messageStubType === 29) {

      await conn.sendMessage(
        m.chat,
        {
          text:
`🎯 @${first(target)} ahora es *admin* del grupo.

📱 Número real: *${targetNumber}*
🌎 País: ${targetInfo.bandera} ${targetInfo.pais}

> Acción realizada por: @${first(actor)}
> 📱 Número real: *${actorNumber}*
> 🌎 País: ${actorInfo.bandera} ${actorInfo.pais}`,

          mentions
        }
      )
    }

    /*
     * DEJÓ DE SER ADMIN
     */
    if (m.messageStubType === 30) {

      await conn.sendMessage(
        m.chat,
        {
          text:
`🏮 @${first(target)} *ya no es admin* del grupo.

📱 Número real: *${targetNumber}*
🌎 País: ${targetInfo.bandera} ${targetInfo.pais}

> Acción realizada por: @${first(actor)}
> 📱 Número real: *${actorNumber}*
> 🌎 País: ${actorInfo.bandera} ${actorInfo.pais}`,

          mentions
        }
      )
    }

  } catch (e) {

    console.error(
      '[detect-admin.before]',
      e,
      {
        stub:
          m?.messageStubType,

        type:
          WAMessageStubType?.[
            m?.messageStubType
          ],

        actor:
          m?.sender ||
          m?.key?.participant,

        target:
          m?.messageStubParameters?.[0]
      }
    )
  }
}

export default handler
