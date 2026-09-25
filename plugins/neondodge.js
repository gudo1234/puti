let handler = async (m, { conn }) => {

await conn.relayMessage(
  m.chat,
  {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: "",
        botResponseId: "nixel-neon-dodge-8872c18c0b5eaaaa"
      }
    },

    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,

          submessages: [
            {
              messageType: 2,
              messageText: "⚡ NIXEL NEON DODGE"
            }
          ],

          unifiedResponse: {
            data: Buffer.from(JSON.stringify({
              response_id: "nixel-neon-dodge-8872c18c0b5eaaaa",

              sections: [
                {
                  view_model: {
                    primitive: {
                      __typename: "GenAIaeacdsnwHtmlPrimitive",

                      payload: `<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  font-family: Arial, sans-serif;
}

body {
  background: transparent;
  color: white;
}

.game-card {
  width: 100%;
  max-width: 500px;
  margin: auto;
  overflow: hidden;
  border: 3px solid #8b5cf6;
  border-radius: 22px;
  background: #080516;
  box-shadow: 0 0 30px rgba(139, 92, 246, .45);
}

.header {
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(90deg, #12052d, #241052);
  border-bottom: 1px solid #8b5cf6;
}

.title {
  font-size: 17px;
  font-weight: bold;
  letter-spacing: 1px;
}

.score {
  color: #00f5ff;
  font-weight: bold;
}

.arena {
  position: relative;
  width: 100%;
  height: 380px;
  overflow: hidden;
  background: radial-gradient(
    circle at 50% 20%,
    #241052 0%,
    #080516 45%,
    #020106 100%
  );
}

.star {
  position: absolute;
  width: 2px;
  height: 2px;
  background: white;
  border-radius: 50%;
  opacity: .7;
  animation: starMove linear infinite;
}

@keyframes starMove {
  from {
    transform: translateY(-30px);
  }

  to {
    transform: translateY(420px);
  }
}

.player {
  position: absolute;
  width: 38px;
  height: 48px;
  bottom: 25px;
  left: 50%;
  transform: translateX(-50%);
  filter: drop-shadow(0 0 12px #00f5ff);
}

.player::before {
  content: '';
  position: absolute;
  left: 9px;
  top: 0;
  width: 20px;
  height: 35px;
  background: linear-gradient(135deg, #fff, #00f5ff);
  clip-path: polygon(
    50% 0,
    100% 100%,
    50% 75%,
    0 100%
  );
}

.player::after {
  content: '';
  position: absolute;
  left: 15px;
  bottom: 0;
  width: 8px;
  height: 15px;
  background: #8b5cf6;
  box-shadow: 0 0 15px #8b5cf6;
  border-radius: 50%;
}

.rock {
  position: absolute;
  width: 25px;
  height: 25px;
  background: linear-gradient(135deg, #777, #222);
  border: 2px solid #aaa;
  border-radius: 35% 55% 45% 40%;
  box-shadow: 0 0 8px rgba(255,255,255,.15);
}

.coin {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffe600;
  border: 3px solid #fff59d;
  box-shadow: 0 0 15px #ffe600;
  animation: spin .7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotateY(180deg);
  }
}

.controls {
  padding: 14px;
  background: #0d0720;
}

.row {
  display: flex;
  gap: 10px;
}

.btn {
  flex: 1;
  padding: 16px 8px;
  border: 0;
  border-radius: 13px;
  color: white;
  font-weight: bold;
  font-size: 14px;
  background: linear-gradient(
    135deg,
    #43209a,
    #7c3aed
  );
  box-shadow: 0 4px 0 #26115c;
}

.btn:active {
  transform: translateY(2px);
  box-shadow: 0 2px 0 #26115c;
}

.start {
  background: linear-gradient(
    135deg,
    #00a8b5,
    #0066ff
  );
  box-shadow: 0 4px 0 #003d99;
}

.status {
  text-align: center;
  margin-top: 12px;
  color: #b8a9d9;
  font-size: 12px;
}

.game-over {
  position: absolute;
  inset: 0;
  display: none;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  background: rgba(3, 1, 10, .85);
  backdrop-filter: blur(5px);
  z-index: 20;
}

.game-over h2 {
  font-size: 30px;
  color: #ff4d8d;
  text-shadow: 0 0 15px #ff4d8d;
}

.game-over p {
  margin-top: 8px;
  color: #ddd;
}

.flash {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: rgba(255,255,255,.25);
  opacity: 0;
  z-index: 15;
}
</style>

<div class="game-card">

  <div class="header">

    <div class="title">
      ⚡ NEON DODGE
    </div>

    <div class="score">
      SCORE:
      <span id="score">0</span>
    </div>

  </div>

  <div class="arena" id="arena">

    <div
      class="flash"
      id="flash">
    </div>

    <div
      class="game-over"
      id="gameOver">

      <h2>
        PERDISTE
      </h2>

      <p>
        Score:
        <span id="finalScore">
          0
        </span>
      </p>

    </div>

    <div
      class="player"
      id="player">
    </div>

  </div>

  <div class="controls">

    <div class="row">

      <button
        class="btn"
        id="left">
        ◀ IZQ
      </button>

      <button
        class="btn start"
        id="start">
        ▶ INICIAR
      </button>

      <button
        class="btn"
        id="right">
        DER ▶
      </button>

    </div>

    <div
      class="status"
      id="status">

      Presiona INICIAR para comenzar

    </div>

  </div>

</div>

<script>
const arena =
  document.getElementById('arena');

const player =
  document.getElementById('player');

const scoreElement =
  document.getElementById('score');

const statusElement =
  document.getElementById('status');

const gameOverElement =
  document.getElementById('gameOver');

const finalScoreElement =
  document.getElementById('finalScore');

const flashElement =
  document.getElementById('flash');

let audioContext = null;
let running = false;
let score = 0;
let playerX = 50;
let speed = 3;
let objects = [];
let gameLoop = null;
let spawnLoop = null;


function initAudio() {

  if (!audioContext) {

    audioContext =
      new (
        window.AudioContext ||
        window.webkitAudioContext
      )();

  }

  if (
    audioContext.state ===
    'suspended'
  ) {

    audioContext.resume();

  }

}


function sound(
  frequency,
  duration = 0.1,
  type = 'sine',
  volume = 0.04
) {

  if (!audioContext) return;

  const oscillator =
    audioContext.createOscillator();

  const gain =
    audioContext.createGain();

  oscillator.type = type;

  oscillator.frequency.value =
    frequency;

  gain.gain.setValueAtTime(
    volume,
    audioContext.currentTime
  );

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    audioContext.currentTime +
      duration
  );

  oscillator.connect(gain);

  gain.connect(
    audioContext.destination
  );

  oscillator.start();

  oscillator.stop(
    audioContext.currentTime +
      duration
  );

}


function startSound() {

  sound(
    300,
    .1,
    'square',
    .04
  );

  setTimeout(
    () =>
      sound(
        500,
        .12,
        'square',
        .04
      ),
    80
  );

  setTimeout(
    () =>
      sound(
        800,
        .18,
        'square',
        .04
      ),
    160
  );

}


function coinSound() {

  sound(
    700,
    .08,
    'sine',
    .05
  );

  setTimeout(
    () =>
      sound(
        1100,
        .12,
        'sine',
        .04
      ),
    70
  );

}


function hitSound() {

  sound(
    100,
    .25,
    'sawtooth',
    .08
  );

  setTimeout(
    () =>
      sound(
        60,
        .35,
        'sawtooth',
        .06
      ),
    100
  );

}


function moveSound() {

  sound(
    250,
    .035,
    'square',
    .015
  );

}


function createStars() {

  for (
    let i = 0;
    i < 35;
    i++
  ) {

    const star =
      document.createElement('div');

    star.className =
      'star';

    star.style.left =
      Math.random() * 100 + '%';

    star.style.top =
      Math.random() * 100 + '%';

    star.style.animationDuration =
      (
        2 +
        Math.random() * 4
      ) + 's';

    star.style.animationDelay =
      (
        Math.random() * 3
      ) + 's';

    arena.appendChild(star);

  }

}


createStars();


function resetGame() {

  objects.forEach(
    obj => {

      if (
        obj.el &&
        obj.el.parentNode
      ) {

        obj.el.remove();

      }

    }
  );

  objects = [];

  score = 0;

  speed = 3;

  playerX = 50;

  scoreElement.textContent =
    score;

  player.style.left =
    playerX + '%';

}


function startGame() {

  initAudio();

  if (running) return;

  resetGame();

  running = true;

  gameOverElement.style.display =
    'none';

  statusElement.textContent =
    '¡Esquiva los meteoritos y recoge las monedas!';

  startSound();

  clearInterval(spawnLoop);

  clearInterval(gameLoop);

  spawnLoop =
    setInterval(
      () => spawnObject(),
      700
    );

  gameLoop =
    setInterval(
      updateGame,
      30
    );

}


function endGame() {

  if (!running) return;

  running = false;

  clearInterval(spawnLoop);

  clearInterval(gameLoop);

  hitSound();

  flashElement.style.opacity =
    '1';

  setTimeout(
    () => {

      flashElement.style.opacity =
        '0';

    },
    100
  );

  finalScoreElement.textContent =
    score;

  gameOverElement.style.display =
    'flex';

  statusElement.textContent =
    'Pulsa START para volver a jugar';

}


function spawnObject() {

  const isCoin =
    Math.random() < 0.18;

  const element =
    document.createElement('div');

  element.className =
    isCoin
      ? 'coin'
      : 'rock';

  const x =
    5 +
    Math.random() * 90;

  element.style.left =
    x + '%';

  element.style.top =
    '-30px';

  arena.appendChild(element);

  objects.push({

    el: element,

    x: x,

    y: -30,

    type:
      isCoin
        ? 'coin'
        : 'rock',

    speed:
      speed +
      Math.random() * 2

  });

}


function updateGame() {

  objects.forEach(
    obj => {

      obj.y += obj.speed;

      obj.el.style.top =
        obj.y + 'px';

      const playerRect =
        player.getBoundingClientRect();

      const objectRect =
        obj.el.getBoundingClientRect();

      const collision =
        playerRect.left <
          objectRect.right &&

        playerRect.right >
          objectRect.left &&

        playerRect.top <
          objectRect.bottom &&

        playerRect.bottom >
          objectRect.top;

      if (collision) {

        if (
          obj.type ===
          'coin'
        ) {

          score += 10;

          scoreElement.textContent =
            score;

          coinSound();

          obj.el.remove();

          obj.remove = true;

        } else {

          endGame();

          obj.remove = true;

        }

      }

      if (obj.y > 410) {

        obj.el.remove();

        obj.remove = true;

      }

    }
  );

  objects =
    objects.filter(
      obj => !obj.remove
    );

  if (
    score > 0 &&
    score % 50 === 0
  ) {

    speed =
      Math.min(
        8,
        3 + score / 100
      );

  }

}


function moveLeft() {

  if (!running) return;

  playerX =
    Math.max(
      7,
      playerX - 8
    );

  player.style.left =
    playerX + '%';

  moveSound();

}


function moveRight() {

  if (!running) return;

  playerX =
    Math.min(
      93,
      playerX + 8
    );

  player.style.left =
    playerX + '%';

  moveSound();

}


document.getElementById(
  'left'
).ontouchstart = moveLeft;


document.getElementById(
  'right'
).ontouchstart = moveRight;


document.getElementById(
  'start'
).ontouchstart = startGame;


document.getElementById(
  'left'
).onclick = moveLeft;


document.getElementById(
  'right'
).onclick = moveRight;


document.getElementById(
  'start'
).onclick = startGame;


document.addEventListener(
  'keydown',
  event => {

    if (
      event.key ===
      'ArrowLeft'
    ) {

      moveLeft();

    }

    if (
      event.key ===
      'ArrowRight'
    ) {

      moveRight();

    }

    if (
      event.key ===
      'Enter'
    ) {

      startGame();

    }

  }
);
</script>`,

                      trusted_sources: [
                        "nixel.dev"
                      ]
                    },

                    __typename:
                      "GenAISingleLayoutViewModel"
                  }
                }
              ]
            })).toString('base64')
          },

          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,

            forwardedAiBotMessageInfo: {
              botJid:
                "867051314767696@bot"
            },

            forwardOrigin: 4
          }
        }
      }
    }
  },

  {
    messageId:
      m?.key?.id ||
      `NIXEL-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}`
  }
)
}

handler.help = ["neon"]
handler.tags = ["juegos"]
handler.command = ['neon']
handler.group = true

export default handler
