import fetch from "node-fetch";
import axios from "axios";

let handler = async (m, { conn, args }) => {
    if (!args.length)
        return m.reply(`${e} Debes proporcionar un *texto o enlace* de Spotify.`);

    const q = args.join(" ");
    let trackData = null;
    let thumbBuffer = null;

    const spotifyRegex = /https?:\/\/open\.spotify\.com\/(track|album|playlist)\/[a-zA-Z0-9]+/;
    const isUrl = spotifyRegex.test(q);

    await m.react("🕒");

    try {
        if (isUrl) {
            const url = q.match(spotifyRegex)[0];
            const res = await fetch(`https://api.deline.web.id/downloader/spotify?url=${encodeURIComponent(url)}`);
            const json = await res.json();

            if (!json.status || !json.result || !json.result.medias?.length)
                throw new Error("No se encontró información para la URL proporcionada");

            const data = json.result;
            trackData = {
                title: data.title,
                artist: data.author,
                duration: data.duration,
                image: data.thumbnail,
                download: data.medias[0].url,
                extension: data.medias[0].extension || "mp3"
            };

        } else {
            const res = await fetch(`https://api.deline.web.id/downloader/spotifyplay?q=${encodeURIComponent(q)}`);
            const json = await res.json();

            if (!json.status || !json.result?.metadata || !json.result.dlink)
                throw new Error("No se encontró información para la búsqueda proporcionada");

            const meta = json.result.metadata;
            trackData = {
                title: meta.title,
                artist: meta.artist,
                duration: meta.duration,
                image: meta.cover,
                download: json.result.dlink,
                extension: "mp3"
            };
        }

        try {
            const r = await fetch(trackData.image);
            thumbBuffer = Buffer.from(await r.arrayBuffer());
        } catch {
            thumbBuffer = null;
        }

        const infoText =
`➝ *Artista:* ${trackData.artist}
➝ *Duración:* ${trackData.duration}
> ⌗ *Enviando audio...*`;

        await conn.sendMessage(
            m.chat,
            {
                text: infoText,
                contextInfo: {
                    externalAdReply: {
                        title: trackData.title,
                        body: textbot,
                        thumbnailUrl: redes,
                        thumbnail: thumbBuffer,
                        sourceUrl: redes,
                        mediaType: 1
                    }
                }
            },
            { quoted: m }
        );

        const { data, headers } = await axios.get(trackData.download, {
            responseType: "arraybuffer",
            maxRedirects: 5
        });

        const mime = headers["content-type"] || "";
        if (!mime.includes("audio"))
            return m.reply(`${e} El servidor no devolvió audio válido.`);

        await conn.sendMessage(
            m.chat,
            {
                audio: Buffer.from(data),
                mimetype: "audio/mpeg",
                fileName: `${trackData.title}.${trackData.extension}`
            },
            { quoted: m }
        );

        await m.react("✅");

    } catch (err) {
        console.error("SPOTIFY ERROR:", err);
        await m.react("❌");
        return m.reply(`${e} Error al descargar la canción: ${err.message}`);
    }
};

handler.help = ["spotify"];
handler.tags = ["descargas"];
handler.command = ["spotify","sp","spotdl"];
handler.group = true;

export default handler;
