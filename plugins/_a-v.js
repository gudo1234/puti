import fetch from "node-fetch"

const YT1Z = "https://yt1z.top"

const docAudio = ['play3', 'ytadoc', 'mp3doc', 'ytmp3doc']
const docVideo = ['play4', 'ytvdoc', 'mp4doc', 'ytmp4doc']
const normalAudio = ['play', 'yta', 'mp3', 'ytmp3', 'playaudio']
const normalVideo = ['play2', 'ytv', 'mp4', 'ytmp4', 'playvid']

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const logYT1Z = (stage, data = '') => {
  console.log(`[YT1Z] ${stage}`, data)
}

const safeFetch = async (
  url,
  options = {},
  timeout = 180000
) => {
  let timer

  try {
    const controller =
      new AbortController()

    timer = setTimeout(
      () => controller.abort(),
      timeout
    )

    const headers = {
      'User-Agent': USER_AGENT,
      'Accept':
        'text/html,application/xhtml+xml,application/json,*/*;q=0.8',
      'Accept-Language':
        'en-US,en;q=0.9',
      'Cache-Control':
        'no-cache',
      'Pragma':
        'no-cache',
      'Referer':
        `${YT1Z}/`,
      ...(options.headers || {})
    }

    logYT1Z(
      'REQUEST',
      url
    )

    const res =
      await fetch(url, {
        ...options,
        headers,
        signal:
          controller.signal,
        redirect: 'follow'
      })

    logYT1Z(
      'RESPONSE',
      `status=${res.status} | type=${res.headers.get('content-type') || ''} | final=${res.url}`
    )

    const disposition =
      res.headers.get(
        'content-disposition'
      )

    if (disposition) {
      logYT1Z(
        'CONTENT-DISPOSITION',
        disposition
      )
    }

    return res

  } catch (err) {
    logYT1Z(
      'FETCH ERROR',
      err?.name === 'AbortError'
        ? 'TIMEOUT'
        : err?.message || err
    )

    return null

  } finally {
    if (timer) {
      clearTimeout(timer)
    }
  }
}

const htmlDecode = (str = '') => {
  return String(str)
    .replace(
      /&amp;/gi,
      '&'
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&apos;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      '<'
    )
    .replace(
      /&gt;/gi,
      '>'
    )
    .replace(
      /&#x27;/gi,
      "'"
    )
    .replace(
      /&#x2F;/gi,
      '/'
    )
    .replace(
      /&#x3D;/gi,
      '='
    )
    .replace(
      /&#x26;/gi,
      '&'
    )
    .replace(
      /&#x25;/gi,
      '%'
    )
    .replace(
      /&#(\d+);/g,
      (_, n) => {
        const code =
          Number(n)

        return Number.isFinite(code)
          ? String.fromCharCode(code)
          : _
      }
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, n) => {
        const code =
          parseInt(n, 16)

        return Number.isFinite(code)
          ? String.fromCharCode(code)
          : _
      }
    )
}

const decodeJs = (str = '') => {
  let value =
    String(str)

  for (
    let i = 0;
    i < 5;
    i++
  ) {
    const old =
      value

    value =
      value
        .replace(
          /\\u0026/gi,
          '&'
        )
        .replace(
          /\\u003d/gi,
          '='
        )
        .replace(
          /\\u002f/gi,
          '/'
        )
        .replace(
          /\\u0025/gi,
          '%'
        )
        .replace(
          /\\x26/gi,
          '&'
        )
        .replace(
          /\\x3d/gi,
          '='
        )
        .replace(
          /\\x2f/gi,
          '/'
        )
        .replace(
          /\\x25/gi,
          '%'
        )
        .replace(
          /\\\//g,
          '/'
        )
        .replace(
          /\\"/g,
          '"'
        )
        .replace(
          /\\'/g,
          "'"
        )
        .replace(
          /\\\\/g,
          '\\'
        )

    if (value === old) {
      break
    }
  }

  return value
}

const cleanText = (str = '') => {
  return htmlDecode(str)
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      ' '
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      ' '
    )
    .replace(
      /<[^>]*>/g,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim()
}

const absoluteUrl = value => {
  if (!value) {
    return ''
  }

  let url =
    decodeJs(
      htmlDecode(
        String(value).trim()
      )
    )

  url =
    url
      .replace(
        /^['"`]+|['"`]+$/g,
        ''
      )
      .trim()

  if (!url) {
    return ''
  }

  if (
    /^(?:javascript|data|mailto|tel):/i.test(
      url
    )
  ) {
    return ''
  }

  if (
    url.startsWith('//')
  ) {
    return `https:${url}`
  }

  try {
    return new URL(
      url,
      YT1Z
    ).href
  } catch {
    return ''
  }
}

const isYouTubeUrl = url => {
  return /(?:youtube\.com|youtu\.be)/i.test(
    String(url || '')
  )
}

const isBadAsset = url => {
  return /\.(?:css|js|png|jpg|jpeg|gif|svg|webp|ico|woff|woff2|ttf)(?:[?#]|$)/i.test(
    String(url || '')
  )
}

const isPossibleDownload = url => {
  if (!url) {
    return false
  }

  const value =
    String(url).trim()

  if (
    /^(?:javascript|data|mailto|tel):/i.test(
      value
    )
  ) {
    return false
  }

  if (
    isYouTubeUrl(value)
  ) {
    return false
  }

  if (
    isBadAsset(value)
  ) {
    return false
  }

  return /^https?:\/\//i.test(
    value
  )
}

const getVideoId = text => {
  const value =
    String(text || '')
      .trim()

  const patterns = [
    /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/i,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  ]

  for (
    const regex of patterns
  ) {
    const match =
      value.match(regex)

    if (match?.[1]) {
      return match[1]
    }
  }

  return null
}

const searchYT1Z = async query => {
  const res =
    await safeFetch(
      `${YT1Z}/s/`,
      {
        method: 'POST',
        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
          'Origin':
            YT1Z,
          'Referer':
            `${YT1Z}/`
        },
        body:
          new URLSearchParams({
            search: query
          }).toString()
      },
      60000
    )

  if (!res) {
    throw new Error(
      'SEARCH_FETCH_FAILED'
    )
  }

  const raw =
    await res.text()

  logYT1Z(
    'SEARCH BODY',
    raw.slice(0, 500)
  )

  if (!raw) {
    throw new Error(
      'SEARCH_EMPTY_RESPONSE'
    )
  }

  let json = null

  try {
    json =
      JSON.parse(raw)
  } catch {
    const start =
      raw.indexOf('[')

    const end =
      raw.lastIndexOf(']')

    if (
      start !== -1 &&
      end !== -1 &&
      end > start
    ) {
      try {
        json =
          JSON.parse(
            raw.slice(
              start,
              end + 1
            )
          )
      } catch {}
    }
  }

  if (!Array.isArray(json)) {
    throw new Error(
      'SEARCH_INVALID_JSON'
    )
  }

  return json
    .filter(
      item => item?.videoId
    )
    .map(item => {
      const videoId =
        String(
          item.videoId
        ).trim()

      return {
        videoId,
        title:
          cleanText(
            item.title || ''
          ),
        url:
          `https://youtu.be/${videoId}`,
        thumbnail:
          `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
      }
    })
    .filter(
      item => item.videoId
    )
}

const extractMeta = (
  html,
  key
) => {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      'i'
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["'][^>]*>`,
      'i'
    )
  ]

  for (
    const regex of patterns
  ) {
    const match =
      html.match(regex)

    if (match?.[1]) {
      return cleanText(
        match[1]
      )
    }
  }

  return ''
}

const extractTagText = (
  html,
  tag,
  className
) => {
  const regex =
    new RegExp(
      `<${tag}[^>]*class=["'][^"']*\\b${className}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,
      'i'
    )

  const match =
    html.match(regex)

  return match
    ? cleanText(match[1])
    : ''
}

const extractInfo = html => {
  return {
    title:
      extractMeta(
        html,
        'og:title'
      ) ||
      extractMeta(
        html,
        'twitter:title'
      ) ||
      extractTagText(
        html,
        'h1',
        'dl-title'
      ) ||
      extractTagText(
        html,
        'h2',
        'dl-title'
      ) ||
      extractTagText(
        html,
        'div',
        'dl-title'
      ) ||
      '',

    thumbnail:
      extractMeta(
        html,
        'og:image'
      ) ||
      extractMeta(
        html,
        'twitter:image'
      ) ||
      '',

    author:
      extractTagText(
        html,
        'div',
        'dl-author'
      ) ||
      extractTagText(
        html,
        'span',
        'dl-author'
      ) ||
      extractTagText(
        html,
        'div',
        'author'
      ) ||
      extractTagText(
        html,
        'span',
        'author'
      ) ||
      extractTagText(
        html,
        'div',
        'channel'
      ) ||
      '',

    duration:
      extractTagText(
        html,
        'div',
        'dl-duration'
      ) ||
      extractTagText(
        html,
        'span',
        'dl-duration'
      ) ||
      extractTagText(
        html,
        'div',
        'duration'
      ) ||
      ''
  }
}

/*
 * NUEVO:
 * /d/ devuelve un iframe:
 *
 * <iframe id="mp3b"...></iframe>
 * <script>
 * setTimeout(function(){
 *   document.getElementById('mp3b')
 *   .setAttribute('src',"/button/?url=https://youtu.be/...");
 * },200);
 * </script>
 *
 * Extraemos ese /button/.
 */
const extractButtonUrl = (
  html
) => {
  if (!html) {
    return null
  }

  const decoded =
    decodeJs(
      htmlDecode(html)
    )

  const patterns = [
    /setAttribute\s*\(\s*['"]src['"]\s*,\s*['"]([^'"]*\/button\/\?[^'"]+)['"]\s*\)/i,

    /(?:src\s*=\s*|src=["'])([^"'<>]*\/button\/\?[^"'<>]+)/i,

    /(\/button\/\?url=[^"'<> \t\r\n]+)/i,

    /(https?:\/\/[^"'<> \t\r\n]*\/button\/\?url=[^"'<> \t\r\n]+)/i
  ]

  for (
    const regex of patterns
  ) {
    const match =
      decoded.match(regex)

    if (match?.[1]) {
      const buttonUrl =
        absoluteUrl(
          match[1]
        )

      if (buttonUrl) {
        logYT1Z(
          'BUTTON URL FOUND',
          buttonUrl
        )

        return buttonUrl
      }
    }
  }

  return null
}

const extractDownloadLink = (
  html,
  format
) => {
  if (!html) {
    return null
  }

  const candidates = []

  const add = (
    value,
    context = '',
    priority = 0
  ) => {
    const url =
      absoluteUrl(value)

    if (
      !isPossibleDownload(url)
    ) {
      return
    }

    if (
      candidates.some(
        item =>
          item.url === url
      )
    ) {
      return
    }

    candidates.push({
      url,
      context: cleanText(
        context
      ),
      priority
    })
  }

  let match

  const hrefRegex =
    /\bhref\s*=\s*["']([^"']+)["']/gi

  while (
    (match =
      hrefRegex.exec(html)) !== null
  ) {
    add(
      match[1],
      html.slice(
        Math.max(
          0,
          match.index - 700
        ),
        Math.min(
          html.length,
          match.index + 1200
        )
      ),
      150
    )
  }

  const dataRegex =
    /\bdata-(?:url|href|download|link|file|src)\s*=\s*["']([^"']+)["']/gi

  while (
    (match =
      dataRegex.exec(html)) !== null
  ) {
    add(
      match[1],
      html.slice(
        Math.max(
          0,
          match.index - 700
        ),
        Math.min(
          html.length,
          match.index + 1200
        )
      ),
      200
    )
  }

  const onclickRegex =
    /\bonclick\s*=\s*["']([^"']+)["']/gi

  while (
    (match =
      onclickRegex.exec(html)) !== null
  ) {
    const code =
      decodeJs(
        htmlDecode(
          match[1]
        )
      )

    const urls =
      code.match(
        /(?:https?:\/\/|\/\/|\/)[^'"`\s)<>]+/gi
      ) || []

    for (
      const url of urls
    ) {
      add(
        url,
        code,
        230
      )
    }
  }

  const variableRegex =
    /(?:downloadUrl|download_url|downloadLink|download_link|mediaUrl|media_url|fileUrl|file_url|videoUrl|video_url|audioUrl|audio_url|file|url|link|href|src)\s*[:=]\s*["'`]([^"'`]+)["'`]/gi

  while (
    (match =
      variableRegex.exec(html)) !== null
  ) {
    add(
      match[1],
      match[0],
      220
    )
  }

  const absoluteRegex =
    /https?:\/\/[^\s"'<>\\]+/gi

  while (
    (match =
      absoluteRegex.exec(html)) !== null
  ) {
    add(
      match[0],
      'absolute-url',
      80
    )
  }

  const ranked =
    candidates
      .map(item => {
        let score =
          item.priority

        const context =
          item.context.toLowerCase()

        const url =
          item.url.toLowerCase()

        if (
          /download|descargar|save|get file|get video|get audio/i.test(
            context
          )
        ) {
          score += 200
        }

        if (
          /\/(?:download|dl|file|media|video|audio)\b/i.test(
            url
          )
        ) {
          score += 120
        }

        if (
          format === 'mp3' &&
          /\.mp3(?:[?#]|$)/i.test(
            url
          )
        ) {
          score += 300
        }

        if (
          format !== 'mp3' &&
          /\.mp4(?:[?#]|$)/i.test(
            url
          )
        ) {
          score += 300
        }

        return {
          ...item,
          score
        }
      })
      .sort(
        (a, b) =>
          b.score - a.score
      )

  logYT1Z(
    'DOWNLOAD CANDIDATES',
    `total=${ranked.length}`
  )

  for (
    const candidate of ranked.slice(
      0,
      10
    )
  ) {
    logYT1Z(
      'CANDIDATE',
      `score=${candidate.score} | ${candidate.url}`
    )
  }

  return ranked[0]?.url || null
}

/*
 * Busca URLs JSON.
 */
const extractJsonLink = html => {
  const decoded =
    decodeJs(
      htmlDecode(html)
    )

  const regex =
    /["'](?:url|downloadUrl|download_url|downloadLink|download_link|fileUrl|file_url|mediaUrl|media_url|link)["']\s*:\s*["']([^"']+)["']/gi

  let match

  while (
    (match =
      regex.exec(decoded)) !== null
  ) {
    const url =
      absoluteUrl(
        match[1]
      )

    if (
      isPossibleDownload(url)
    ) {
      return url
    }
  }

  return null
}

/*
 * NUEVO FLUJO COMPLETO:
 *
 * /d/
 *   ↓
 * /button/
 *   ↓
 * enlace final
 */
const processYT1Z = async (
  url,
  format
) => {
  const params =
    new URLSearchParams({
      url,
      lng: 'en',
      t: '',
      fmt: format
    })

  const endpoint =
    `${YT1Z}/d/?${params.toString()}`

  logYT1Z(
    'PROCESS',
    `format=${format} | video=${url}`
  )

  const res =
    await safeFetch(
      endpoint,
      {
        method: 'GET',
        headers: {
          'Referer':
            `${YT1Z}/`,
          'Origin':
            YT1Z
        }
      },
      180000
    )

  if (!res) {
    throw new Error(
      'D_ENDPOINT_FETCH_FAILED'
    )
  }

  if (
    !res.ok
  ) {
    const body =
      await res.text()

    logYT1Z(
      'D ERROR BODY',
      body.slice(
        0,
        1500
      )
    )

    throw new Error(
      `D_HTTP_${res.status}`
    )
  }

  const body =
    await res.text()

  if (!body) {
    throw new Error(
      'D_EMPTY_RESPONSE'
    )
  }

  logYT1Z(
    'D BODY',
    body.slice(
      0,
      1200
    )
  )

  /*
   * PRIMERA POSIBILIDAD:
   * /d/ ya devolvió directamente
   * el archivo.
   */
  const finalUrl =
    res.url

  const contentType =
    res.headers.get(
      'content-type'
    ) || ''

  const disposition =
    res.headers.get(
      'content-disposition'
    ) || ''

  if (
    finalUrl &&
    finalUrl !== endpoint &&
    isPossibleDownload(
      finalUrl
    ) &&
    (
      /audio\/|video\//i.test(
        contentType
      ) ||
      /attachment|filename=/i.test(
        disposition
      ) ||
      /\.mp3(?:[?#]|$)/i.test(
        finalUrl
      ) ||
      /\.mp4(?:[?#]|$)/i.test(
        finalUrl
      )
    )
  ) {
    logYT1Z(
      'DIRECT FILE',
      finalUrl
    )

    return {
      link: finalUrl,
      ...extractInfo(body)
    }
  }

  /*
   * SEGUNDA POSIBILIDAD:
   * buscar enlace JSON.
   */
  const jsonLink =
    extractJsonLink(body)

  if (jsonLink) {
    logYT1Z(
      'JSON DOWNLOAD LINK',
      jsonLink
    )

    return {
      link: jsonLink,
      ...extractInfo(body)
    }
  }

  /*
   * TERCERA POSIBILIDAD:
   * buscar el /button/.
   */
  const buttonUrl =
    extractButtonUrl(body)

  if (!buttonUrl) {
    throw new Error(
      `BUTTON_ENDPOINT_NOT_FOUND | body=${body.slice(0, 800)}`
    )
  }

  /*
   * Esperamos un poco porque el navegador
   * de YT1Z hace el cambio después de 200ms.
   */
  await new Promise(
    resolve =>
      setTimeout(
        resolve,
        300
      )
  )

  logYT1Z(
    'FETCHING BUTTON',
    buttonUrl
  )

  const buttonRes =
    await safeFetch(
      buttonUrl,
      {
        method: 'GET',
        headers: {
          'Referer':
            endpoint,
          'Origin':
            YT1Z,
          'Accept':
            'text/html,application/xhtml+xml,application/json,*/*;q=0.8'
        }
      },
      120000
    )

  if (!buttonRes) {
    throw new Error(
      'BUTTON_FETCH_FAILED'
    )
  }

  if (
    !buttonRes.ok
  ) {
    const buttonError =
      await buttonRes.text()

    logYT1Z(
      'BUTTON ERROR BODY',
      buttonError.slice(
        0,
        1500
      )
    )

    throw new Error(
      `BUTTON_HTTP_${buttonRes.status}`
    )
  }

  const buttonType =
    buttonRes.headers.get(
      'content-type'
    ) || ''

  const buttonDisposition =
    buttonRes.headers.get(
      'content-disposition'
    ) || ''

  const buttonFinalUrl =
    buttonRes.url

  logYT1Z(
    'BUTTON RESPONSE',
    `type=${buttonType} | final=${buttonFinalUrl}`
  )

  /*
   * Puede que /button/ redirija
   * directamente al archivo.
   */
  if (
    buttonFinalUrl &&
    buttonFinalUrl !== buttonUrl &&
    isPossibleDownload(
      buttonFinalUrl
    ) &&
    (
      /audio\/|video\//i.test(
        buttonType
      ) ||
      /attachment|filename=/i.test(
        buttonDisposition
      ) ||
      /\.mp3(?:[?#]|$)/i.test(
        buttonFinalUrl
      ) ||
      /\.mp4(?:[?#]|$)/i.test(
        buttonFinalUrl
      )
    )
  ) {
    logYT1Z(
      'BUTTON REDIRECT FILE',
      buttonFinalUrl
    )

    return {
      link:
        buttonFinalUrl,
      ...extractInfo(body)
    }
  }

  const buttonBody =
    await buttonRes.text()

  if (!buttonBody) {
    throw new Error(
      'BUTTON_EMPTY_RESPONSE'
    )
  }

  logYT1Z(
    'BUTTON BODY',
    buttonBody.slice(
      0,
      2500
    )
  )

  /*
   * Buscar el enlace final.
   */
  const finalJsonLink =
    extractJsonLink(
      buttonBody
    )

  if (finalJsonLink) {
    logYT1Z(
      'FINAL JSON LINK',
      finalJsonLink
    )

    return {
      link:
        finalJsonLink,
      ...extractInfo(body)
    }
  }

  const finalHtmlLink =
    extractDownloadLink(
      buttonBody,
      format
    )

  if (finalHtmlLink) {
    logYT1Z(
      'FINAL HTML LINK',
      finalHtmlLink
    )

    return {
      link:
        finalHtmlLink,
      ...extractInfo(body)
    }
  }

  throw new Error(
    `FINAL_DOWNLOAD_LINK_NOT_FOUND | buttonBody=${buttonBody.slice(0, 1200)}`
  )
}

const secondsFromDuration = (
  duration
) => {
  if (!duration) {
    return 0
  }

  const clean =
    String(duration)
      .replace(
        /[^\d:]/g,
        ''
      )
      .trim()

  if (!clean) {
    return 0
  }

  const parts =
    clean
      .split(':')
      .map(Number)

  if (
    parts.some(
      value =>
        !Number.isFinite(value)
    )
  ) {
    return 0
  }

  return parts.reduce(
    (total, value) =>
      total * 60 + value,
    0
  )
}

const handler = async (
  m,
  {
    conn,
    text,
    command,
    args
  }
) => {
  if (!text) {
    const tipo =
      normalAudio.includes(
        command
      )
        ? 'audio'
        : docAudio.includes(
            command
          )
        ? 'audio en documento'
        : normalVideo.includes(
            command
          )
        ? 'video'
        : 'video en documento'

    return m.reply(
      `${e} Ingresa _texto_ o _enlace_ de YouTube para descargar el *${tipo}.*`
    )
  }

  await m.react(
    "🕒"
  )

  let stage =
    'inicio'

  try {
    stage =
      'procesando consulta'

    const query =
      args.join(" ").trim()

    const videoId =
      getVideoId(query)

    let videoUrl = ''
    let searchInfo = null

    if (videoId) {
      videoUrl =
        `https://youtu.be/${videoId}`

      searchInfo = {
        videoId,
        title: '',
        url: videoUrl,
        thumbnail:
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      }

      logYT1Z(
        'VIDEO ID',
        videoId
      )

    } else {
      stage =
        'buscando video'

      const results =
        await searchYT1Z(
          query
        )

      if (
        !results?.length
      ) {
        throw new Error(
          'SEARCH_NO_RESULTS'
        )
      }

      searchInfo =
        results[0]

      videoUrl =
        searchInfo.url

      logYT1Z(
        'SEARCH RESULT',
        JSON.stringify(
          searchInfo
        )
      )
    }

    const isAudio = [
      ...docAudio,
      ...normalAudio
    ].includes(
      command
    )

    const sendDoc =
      docAudio.includes(
        command
      ) ||
      docVideo.includes(
        command
      )

    const format =
      isAudio
        ? 'mp3'
        : 'mp4-any'

    stage =
      `procesando YT1Z (${format})`

    const data =
      await processYT1Z(
        videoUrl,
        format
      )

    if (
      !data?.link
    ) {
      throw new Error(
        'DOWNLOAD_LINK_EMPTY'
      )
    }

    logYT1Z(
      'DOWNLOAD READY',
      data.link
    )

    const title =
      data.title ||
      searchInfo?.title ||
      'YouTube'

    const thumbnail =
      data.thumbnail ||
      searchInfo?.thumbnail ||
      `https://i.ytimg.com/vi/${searchInfo?.videoId}/hqdefault.jpg`

    const duration =
      data.duration ||
      'No disponible'

    const author =
      data.author ||
      'YouTube'

    const durationSeconds =
      secondsFromDuration(
        duration
      )

    const automaticDoc =
      !docAudio.includes(
        command
      ) &&
      !docVideo.includes(
        command
      ) &&
      durationSeconds / 60 > 20

    const finalDoc =
      sendDoc ||
      automaticDoc

    const type =
      isAudio
        ? (
            finalDoc
              ? 'audio (doc)'
              : 'audio'
          )
        : (
            finalDoc
              ? 'video (doc)'
              : 'video'
          )

    const aviso =
      automaticDoc
        ? `\n> ‣ Se enviará como documento por superar 20 minutos.`
        : ''

    const caption =
      `╭──── • ────╮
> ✰ *Título:* ${title}
> ♢ *Canal:* ${author}
> ♪ *Duración:* ${duration}
> ♬ *Link:* ${videoUrl}
╰──── • ────╯

⏳ _Preparando ${type}..._${aviso}`.trim()

    stage =
      'enviando información'

    await conn.sendMessage(
      m.chat,
      {
        image: {
          url: thumbnail
        },
        caption
      },
      {
        quoted: m
      }
    )

    const ext =
      isAudio
        ? 'mp3'
        : 'mp4'

    const mimetype =
      isAudio
        ? 'audio/mpeg'
        : 'video/mp4'

    const safeTitle =
      title
        .replace(
          /[\\/:*?"<>|]/g,
          ''
        )
        .replace(
          /\s+/g,
          ' '
        )
        .trim()
        .slice(
          0,
          100
        ) ||
      'YouTube'

    const fileName =
      `${safeTitle}.${ext}`

    const msg =
      finalDoc
        ? {
            document: {
              url: data.link
            },
            mimetype,
            fileName
          }
        : {
            [isAudio
              ? 'audio'
              : 'video']: {
              url: data.link
            },
            mimetype,
            fileName,
            ptt: false
          }

    stage =
      `enviando ${type}`

    await conn.sendMessage(
      m.chat,
      msg,
      {
        quoted: m
      }
    )

    await m.react(
      "✨"
    )

    logYT1Z(
      'SUCCESS',
      data.link
    )

  } catch (err) {
    const error =
      err?.message ||
      String(err)

    console.error(
      `[YT1Z ERROR] stage=${stage}`
    )

    console.error(
      `[YT1Z ERROR] ${error}`
    )

    await m.react(
      "✖️"
    )

    return m.reply(
      `${e} *YT1Z falló.*

> *Etapa:* ${stage}
> *Error:* ${error.slice(0, 1200)}

> Revisa la consola del bot para ver el diagnóstico completo.`
    )
  }
}

handler.command = [
  'play',
  'yta',
  'mp3',
  'ytmp3',
  'playaudio',

  'play3',
  'ytadoc',
  'mp3doc',
  'ytmp3doc',

  'play2',
  'ytv',
  'mp4',
  'ytmp4',
  'playvid',

  'play4',
  'ytvdoc',
  'mp4doc',
  'ytmp4doc'
]

handler.group = true

export default handler
