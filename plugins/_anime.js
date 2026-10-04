import fetch from 'node-fetch';

const symbols = ['(⁠◠⁠‿⁠◕⁠)', '˃͈◡˂͈', '૮(˶ᵔᵕᵔ˶)ა', '(づ｡◕‿‿◕｡)づ', '(✿◡‿◡)', '(꒪⌓꒪)', '(✿✪‿✪｡)', '(*≧ω≦)', '(✧ω◕)', '˃ 𖥦 ˂', '(⌒‿⌒)', '(¬‿¬)', '(✧ω✧)', '✿(◕ ‿◕)✿', 'ʕ•́ᴥ•̀ʔっ', '(ㅇㅅㅇ❀)', '(∩︵∩)', '(✪ω✪)', '(✯◕‿◕✯)', '(•̀ᴗ•́)و ̑̑'];

function getRandomSymbol() {
  return symbols[Math.floor(Math.random() * symbols.length)];
}

const captions = {
  peek: (from, to) => from === to ? 'está espiando detrás de una puerta por diversión.' : 'está espiando a',
  comfort: (from, to) => from === to ? 'se está consolando.' : 'está consolando a',
  thinkhard: (from, to) => from === to ? 'se quedó pensando muy intensamente.' : 'está pensando profundamente en',
  curious: (from, to) => from === to ? 'se muestra con curiosidad por todo.' : 'siente curiosidad por lo que hace',
  sniff: (from, to) => from === to ? 'se olfatea como si buscara algo raro.' : 'está olfateando a',
  stare: (from, to) => from === to ? 'se queda mirando al techo sin razón.' : 'se queda mirando fijamente a',
  trip: (from, to) => from === to ? 'se tropezó consigo, otra vez.' : 'tropezó accidentalmente con',
  blowkiss: (from, to) => from === to ? 'se manda un beso al espejo.' : 'le lanzó un beso a',
  snuggle: (from, to) => from === to ? 'se acurruca con una almohada suave.' : 'se acurruca dulcemente con',
  sleep: (from, to) => from === to ? 'está durmiendo plácidamente.' : 'está durmiendo con',
  cold: (from, to) => from === to ? 'tiene mucho frío.' : 'se congela por el frío de',
  sing: (from, to) => from === to ? 'está cantando.' : 'le está cantando a',
  tickle: (from, to) => from === to ? 'se está haciendo cosquillas.' : 'le está haciendo cosquillas a',
  scream: (from, to) => from === to ? 'está gritando al viento.' : 'le está gritando a',
  push: (from, to) => from === to ? 'se empujó a sí.' : 'empujó a',
  nope: (from, to) => from === to ? 'expresa claramente su desacuerdo.' : 'dice "¡No!" a',
  jump: (from, to) => from === to ? 'salta de felicidad.' : 'salta feliz con',
  heat: (from, to) => from === to ? 'siente mucho calor.' : 'tiene calor por',
  gaming: (from, to) => from === to ? 'está jugando en solitario.' : 'está jugando con',
  draw: (from, to) => from === to ? 'hace un lindo dibujo.' : 'dibuja inspirado en',
  call: (from, to) => from === to ? 'marca su propio número esperando respuesta.' : 'llamó al número de',
  seduce: (from, to) => from === to ? 'lanzó una mirada seductora al vacío.' : 'está intentando seducir a',
  shy: (from, to) => from === to ? 'se sonrojó tímidamente y desvió la mirada.' : 'siente timidez al mirar a',
  slap: (from, to) => from === to ? 'se dio una bofetada.' : 'le dio una bofetada a',
  bath: (from, to) => from === to ? 'se está bañando.' : 'está bañando a',
  angry: (from, to) => from === to ? 'está con mucho enojo.' : 'siente mucho enojo con',
  bored: (from, to) => from === to ? 'está con aburrimiento.' : 'siente aburrimiento por',
  bite: (from, to) => from === to ? 'se dio una mordida.' : 'mordió a',
  bleh: (from, to) => from === to ? 'se sacó la lengua frente al espejo.' : 'le está haciendo muecas con la lengua a',
  bonk: (from, to) => from === to ? 'se dio un golpe en la cabeza.' : 'le dio un golpe a',
  blush: (from, to) => from === to ? 'se sonrojó.' : 'se sonrojó por',
  impregnate: (from, to) => from === to ? 'se embarazó.' : 'embarazó a',
  bully: (from, to) => from === to ? 'se está haciendo bullying… alguien que le dé un abrazo.' : 'le está haciendo bullying a',
  cry: (from, to) => from === to ? 'está llorando.' : 'está llorando por',
  happy: (from, to) => from === to ? 'está feliz.' : 'está feliz con',
  coffee: (from, to) => from === to ? 'está tomando café.' : 'está tomando café con',
  clap: (from, to) => from === to ? 'está aplaudiendo por algo.' : 'está aplaudiendo por',
  cringe: (from, to) => from === to ? 'siente cringe.' : 'siente cringe por',
  dance: (from, to) => from === to ? 'está bailando.' : 'está bailando con',
  cuddle: (from, to) => from === to ? 'se acurrucó en soledad.' : 'se acurrucó con',
  drunk: (from, to) => from === to ? 'está bajo los efectos del alcohol.' : 'está bajo los efectos del alcohol con',
  dramatic: (from, to) => from === to ? 'está haciendo un drama exagerado.' : 'le está haciendo un drama a',
  handhold: (from, to) => from === to ? 'se dio la mano.' : 'le agarró la mano a',
  eat: (from, to) => from === to ? 'está comiendo algo delicioso.' : 'está comiendo con',
  highfive: (from, to) => from === to ? 'se chocó los cinco frente al espejo.' : 'chocó los 5 con',
  hug: (from, to) => from === to ? 'se dio un abrazo.' : 'le dio un abrazo a',
  kill: (from, to) => from === to ? 'se autoeliminó en modo dramático.' : 'asesinó a',
  kiss: (from, to) => from === to ? 'se mandó un beso al aire.' : 'le dio un beso a',
  kisscheek: (from, to) => from === to ? 'se besó en la mejilla usando un espejo.' : 'le dio un beso en la mejilla a',
  lick: (from, to) => from === to ? 'se lamió por curiosidad.' : 'lamió a',
  laugh: (from, to) => from === to ? 'se está riendo de algo.' : 'se está burlando de',
  pat: (from, to) => from === to ? 'se acarició la cabeza con ternura.' : 'le dio una caricia a',
  love: (from, to) => from === to ? 'se quiere mucho.' : 'siente atracción por',
  pout: (from, to) => from === to ? 'está haciendo pucheros.' : 'está haciendo pucheros con',
  punch: (from, to) => from === to ? 'lanzó un puñetazo al aire.' : 'le dio un puñetazo a',
  run: (from, to) => from === to ? 'está corriendo por su vida.' : 'está corriendo con',
  scared: (from, to) => from === to ? 'siente mucho miedo.' : 'siente mucho miedo por',
  sad: (from, to) => from === to ? 'está triste.' : 'está expresando su tristeza a',
  smoke: (from, to) => from === to ? 'está fumando tranquilamente.' : 'está fumando con',
  smile: (from, to) => from === to ? 'está sonriendo.' : 'le sonrió a',
  spit: (from, to) => from === to ? 'escupió accidentalmente.' : 'le escupió a',
  smug: (from, to) => from === to ? 'está presumiendo mucho últimamente.' : 'está presumiendo a',
  think: (from, to) => from === to ? 'está pensando profundamente.' : 'no puede dejar de pensar en',
  step: (from, to) => from === to ? 'se pisó accidentalmente.' : 'está pisando a',
  wave: (from, to) => from === to ? 'se saludó frente al espejo.' : 'está saludando a',
  walk: (from, to) => from === to ? 'salió a caminar en soledad.' : 'decidió dar un paseo con',
  wink: (from, to) => from === to ? 'se guiñó un ojo frente al espejo.' : 'le guiñó un ojo a',
};

const alias = {
  angry: ['angry', 'enojado', 'enojada'],
  bleh: ['bleh', 'meh'],
  bored: ['bored', 'aburrido', 'aburrida'],
  clap: ['clap', 'aplaudir'],
  coffee: ['coffee', 'cafe'],
  dramatic: ['dramatic', 'drama'],
  drunk: ['drunk', 'ebria', 'ebrio'],
  cold: ['cold'],
  impregnate: ['impregnate', 'preg', 'preñar', 'embarazar'],
  kisscheek: ['kisscheek', 'beso', 'besar'],
  laugh: ['laugh', 'reír'],
  love: ['love', 'amor'],
  pout: ['pout', 'mueca'],
  punch: ['punch', 'golpear'],
  run: ['run', 'correr'],
  sad: ['sad', 'triste'],
  scared: ['scared', 'asustado', 'asustada'],
  seduce: ['seduce', 'seducir'],
  shy: ['shy', 'timido', 'timida'],
  sleep: ['sleep', 'dormir'],
  smoke: ['smoke', 'fumar'],
  spit: ['spit', 'escupir'],
  step: ['step', 'pisar'],
  think: ['think', 'pensar'],
  walk: ['walk', 'caminar'],
  hug: ['hug', 'abrazar'],
  kill: ['kill', 'matar'],
  eat: ['eat', 'nom', 'comer'],
  kiss: ['kiss', 'muak', 'besar'],
  wink: ['wink', 'guiñar'],
  pat: ['pat', 'acariciar'],
  happy: ['happy', 'feliz'],
  bully: ['bully', 'molestar'],
  bite: ['bite', 'morder'],
  blush: ['blush', 'sonrojarse'],
  wave: ['wave', 'saludar'],
  bath: ['bath', 'bañarse'],
  smug: ['smug', 'presumir'],
  smile: ['smile', 'sonreir'],
  highfive: ['highfive', 'chocar'],
  handhold: ['handhold', 'tomar'],
  cringe: ['cringe', 'avergonzarse', 'asco'],
  bonk: ['bonk', 'golpe'],
  cry: ['cry', 'llorar'],
  lick: ['lick', 'lamer'],
  slap: ['slap', 'bofetada'],
  dance: ['dance', 'bailar'],
  cuddle: ['cuddle', 'acurrucar'],
  sing: ['sing', 'cantar'],
  tickle: ['tickle', 'cosquillas'],
  scream: ['scream', 'gritar'],
  push: ['push', 'empujar'],
  nope: ['nope', 'nop'],
  jump: ['jump', 'saltar'],
  heat: ['heat', 'calor'],
  gaming: ['gaming', 'jugar'],
  draw: ['draw', 'dibujar'],
  call: ['call', 'llamar'],
  snuggle: ['snuggle', 'acurrucarse'],
  blowkiss: ['blowkiss', 'besito'],
  trip: ['trip', 'tropezar'],
  stare: ['stare', 'mirar'],
  sniff: ['sniff', 'oler'],
  curious: ['curious', 'curioso', 'curiosa'],
  thinkhard: ['thinkhard', 'pensar'],
  comfort: ['comfort', 'consolar'],
  peek: ['peek', 'mirar'],
};

let handler = async (m, { conn, usedPrefix, command }) => {
  const currentCommand = Object.keys(alias).find(key => alias[key].includes(command)) || command;
  if (!captions[currentCommand]) return;

  const who = m.mentionedJid?.[0] || m.quoted?.sender || m.sender;

  const fromName = await conn.getName(m.sender).catch?.(() => null) || '@' + m.sender.split('@')[0];
  const toName = who === m.sender
    ? fromName
    : await conn.getName(who).catch?.(() => null) || '@' + who.split('@')[0];

  const captionText = captions[currentCommand](fromName, toName);
  const caption = who !== m.sender
    ? `\`${fromName}.\` ${captionText} \`${toName}.\` ${getRandomSymbol()}.`
    : `\`${fromName}\` ${captionText} ${getRandomSymbol()}.`;

  try {
    const response = await fetch(`${global.APIs.yuki.url}/sfw/interaction?inter=${currentCommand}&key=${global.APIs.yuki.key}`);
    const json = await response.json();
    const result = json?.result || json?.url || json?.data;

    if (!result) throw new Error('Sin resultado de la API.');

    await conn.sendMessage(m.chat, {
      video: { url: result },
      gifPlayback: true,
      caption,
      mentions: [...new Set([who, m.sender])]
    }, { quoted: m });
  } catch (e) {
    await m.reply(`> An unexpected error occurred while executing command *${usedPrefix + command}*. Please try again or contact support if the issue persists.\n> [Error: *${e.message}*]`);
  }
};

handler.help = [...new Set(Object.values(alias).flat())];
handler.tags = ['fun-anime'];
handler.group = true;
handler.command = [...new Set(Object.values(alias).flat())];

export default handler;
