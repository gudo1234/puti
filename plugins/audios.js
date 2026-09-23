let handler = async (m, { conn }) => {
  if (!global.db.data.chats[m.chat]?.audio) return;

  const audios = [
    'https://raw.githubusercontent.com/edar123/im/main/media/prueba.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/sad.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/cardigansad.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/iwas.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/juntos.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/space.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/stellar.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/theb.mp3',
    'https://raw.githubusercontent.com/edar123/im/main/media/alanspectre.mp3'
  ];

  const randomAudio = audios[Math.floor(Math.random() * audios.length)];

  conn.sendFile(
    m.chat,
    randomAudio,
    'carro.mp3',
    null,
    m,
    true,
    {
      type: 'audioMessage',
      ptt: true,
      quoted: m,
      ephemeralExpiration: 24 * 60 * 60
    }
  );
};

handler.customPrefix = /💔|🥲|😢|😭|😞|😔|😟|😫|😩|🥺|🙁|😣|😖|😿|🙁/;
handler.command = new RegExp();
export default handler;
