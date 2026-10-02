let handler = async (m, { conn }) => {
  const fechaPartes = new Intl.DateTimeFormat('es-HN', {
    timeZone: 'America/Tegucigalpa',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).formatToParts(new Date())

  const dia = fechaPartes.find(p => p.type === 'day').value
  const mes = fechaPartes.find(p => p.type === 'month').value
  const año = fechaPartes.find(p => p.type === 'year').value
  const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1)
  const mesMayus = mes.toUpperCase()

  const htmlBase = String.raw`<style>
*{box-sizing:border-box}
html,body{margin:0;padding:0;width:100%;min-height:100%;background:#17100b}
body{font-family:Arial,Helvetica,sans-serif;overflow-x:hidden;color:#fff}
.autumn{width:100%;min-height:100vh;padding:12px;display:flex;justify-content:center;position:relative;overflow:hidden;background:radial-gradient(circle at 50% 18%,rgba(255,215,132,.30),transparent 28%),linear-gradient(180deg,#f5c477 0%,#e99b55 28%,#9b5a38 62%,#332219 100%)}
.wrap{width:min(100%,430px);position:relative;z-index:5}
.card{min-height:calc(100vh - 24px);position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.34);border-radius:28px;background:linear-gradient(180deg,rgba(249,184,94,.08),rgba(32,19,13,.38));box-shadow:0 30px 90px rgba(47,20,5,.45),inset 0 1px 0 rgba(255,255,255,.28)}
.card:before{content:"";position:absolute;inset:0;background:linear-gradient(120deg,rgba(255,255,255,.18),transparent 28%,transparent 70%,rgba(255,255,255,.07));pointer-events:none}
.content{position:relative;z-index:6;padding:26px 18px 20px}
.date{text-align:center;font-size:11px;font-weight:900;letter-spacing:4px;color:#fff2cf}
.date:before,.date:after{content:"✦";margin:0 9px;font-size:9px;color:#ffe0a0}
h1{margin:10px 0 0;text-align:center;font-size:clamp(37px,10vw,48px);line-height:.92;letter-spacing:-2.3px;font-weight:950;text-shadow:0 4px 18px rgba(93,40,10,.25)}
h1 span{display:block;color:#fff3d4}
.lead{max-width:320px;margin:14px auto 0;text-align:center;color:rgba(255,247,228,.88);font-size:13px;line-height:1.55}
.sky{height:285px;position:relative;margin:4px -4px 0}
.sun{position:absolute;left:50%;top:53px;width:132px;height:132px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(circle,#fffde0 0%,#ffe39a 37%,#ffbd4d 67%,#ed812b 100%);box-shadow:0 0 25px #ffe5a0,0 0 65px rgba(255,196,77,.78),0 0 120px rgba(255,151,51,.35);animation:sunPulse 4.5s ease-in-out infinite}
.sun:before{content:"";position:absolute;inset:-22px;border-radius:50%;border:2px solid rgba(255,237,170,.20);box-shadow:0 0 0 10px rgba(255,218,125,.08),0 0 0 23px rgba(255,200,84,.05);animation:sunRays 8s linear infinite}
.ray{position:absolute;left:50%;top:50%;width:4px;height:23px;transform-origin:50% 80%;border-radius:9px;background:rgba(255,238,174,.68)}
.r1{transform:translate(-50%,-50%) rotate(0deg) translateY(-94px)}.r2{transform:translate(-50%,-50%) rotate(45deg) translateY(-94px)}.r3{transform:translate(-50%,-50%) rotate(90deg) translateY(-94px)}.r4{transform:translate(-50%,-50%) rotate(135deg) translateY(-94px)}.r5{transform:translate(-50%,-50%) rotate(180deg) translateY(-94px)}.r6{transform:translate(-50%,-50%) rotate(225deg) translateY(-94px)}.r7{transform:translate(-50%,-50%) rotate(270deg) translateY(-94px)}.r8{transform:translate(-50%,-50%) rotate(315deg) translateY(-94px)}
@keyframes sunPulse{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.045)}}@keyframes sunRays{to{transform:rotate(360deg)}}
.hill{position:absolute;left:-20%;bottom:13px;width:140%;height:115px;background:#65412a;border-radius:50% 50% 0 0/80% 80% 0 0}.hill.back{bottom:35px;background:#835035;opacity:.8;transform:scaleX(1.08)}
.ground{position:absolute;left:-5%;bottom:-3px;width:110%;height:92px;background:linear-gradient(180deg,#6b3e25,#3a2419);border-radius:50% 50% 0 0/35% 35% 0 0}
.tree{position:absolute;bottom:36px;z-index:3;width:145px;height:215px;transform-origin:bottom center;filter:drop-shadow(0 8px 7px rgba(48,20,7,.20))}
.tree.left{left:-22px;animation:treeSway 5.5s ease-in-out infinite}.tree.right{right:-22px;transform:scaleX(-1);animation:treeSway 6.5s ease-in-out infinite reverse}
.tree svg{width:100%;height:100%;overflow:visible}.tree .trunkShape{fill:#4b2918}.tree .trunkLight{fill:#704329;opacity:.7}.tree .branchShape{fill:none;stroke:#4b2918;stroke-width:11;stroke-linecap:round;stroke-linejoin:round}.tree .branchFine{fill:none;stroke:#60351d;stroke-width:5;stroke-linecap:round}.tree .foliage{filter:drop-shadow(0 4px 3px rgba(69,25,5,.22))}.tree .leafCluster{transform-box:fill-box;transform-origin:center;animation:clusterSway 4s ease-in-out infinite}
.tree .c1{animation-delay:.1s}.tree .c2{animation-delay:.6s}.tree .c3{animation-delay:1.1s}.tree .c4{animation-delay:1.6s}.tree .c5{animation-delay:2.1s}.tree .c6{animation-delay:2.6s}
@keyframes treeSway{0%,100%{translate:0 0 rotate(-.5deg)}50%{translate:1px 0 rotate(1.2deg)}}@keyframes clusterSway{0%,100%{transform:rotate(-2deg) translateY(0)}50%{transform:rotate(3deg) translateY(-2px)}}
.flower{position:absolute;width:50px;height:50px;z-index:4;animation:bloom 5s ease-in-out infinite;transform-origin:bottom center}
.flower.f1{left:17%;bottom:23px}.flower.f2{left:31%;bottom:14px;width:38px;height:38px;animation-delay:1.2s}.flower.f3{right:17%;bottom:22px;width:46px;height:46px;animation-delay:2.1s}.flower svg{width:100%;height:100%}
@keyframes bloom{0%,100%{transform:rotate(-3deg) scale(.94)}50%{transform:rotate(4deg) scale(1.06)}}
.falling{position:absolute;inset:0;z-index:7;pointer-events:none}.leafdrop{position:absolute;width:14px;height:9px;border-radius:80% 10% 80% 10%;opacity:0;animation:fall linear infinite}
.fd1{left:11%;top:-20px;background:#d65a22;animation-duration:6.5s}.fd2{left:29%;top:-40px;background:#f0a32f;animation-duration:7.2s;animation-delay:1.5s}.fd3{left:54%;top:-10px;background:#bd4320;animation-duration:6.1s;animation-delay:2.7s}.fd4{left:77%;top:-30px;background:#e47c25;animation-duration:8s;animation-delay:.8s}.fd5{left:91%;top:-50px;background:#a83c20;animation-duration:7s;animation-delay:3.1s}
@keyframes fall{0%{opacity:0;transform:translate(0,-20px) rotate(0)}10%{opacity:1}90%{opacity:.9}100%{opacity:0;transform:translate(45px,560px) rotate(480deg)}}
.separator{height:1px;margin:0 8px 15px;background:linear-gradient(90deg,transparent,rgba(255,224,160,.5),transparent)}
.welcome{border:1px solid rgba(255,255,255,.20);border-radius:19px;padding:16px;background:rgba(62,31,18,.27);backdrop-filter:blur(5px);box-shadow:inset 0 1px 0 rgba(255,255,255,.16)}
.welcome-top{display:flex;align-items:center;gap:12px}.icon{width:44px;height:44px;flex:0 0 44px;border-radius:14px;display:grid;place-items:center;background:linear-gradient(145deg,#e99029,#b9471f);box-shadow:0 9px 22px rgba(65,26,8,.28)}
.w-title{font-size:15px;font-weight:900}.w-sub{margin-top:4px;font-size:11px;color:#f1d6b4;line-height:1.35}.pill{margin-left:auto;padding:6px 8px;border-radius:99px;font-size:9px;font-weight:900;letter-spacing:1px;color:#ffe2a8;border:1px solid rgba(255,225,157,.28)}
.copy{margin-top:12px;padding:13px 14px;border-radius:15px;background:rgba(35,17,10,.31);border:1px solid rgba(255,255,255,.10)}.copy p{margin:0;color:#f1dfc9;font-size:12px;line-height:1.6}.copy strong{color:#fff5dc}
.signature{text-align:center;margin-top:16px;font-size:9px;letter-spacing:2.5px;color:rgba(255,229,184,.58)}
.glow{position:absolute;width:5px;height:5px;border-radius:50%;background:#fff0a7;box-shadow:0 0 12px #ffd06a;animation:twinkle 2.5s infinite}.g1{left:9%;top:21%}.g2{right:10%;top:32%;animation-delay:.8s}.g3{left:16%;top:58%;animation-delay:1.4s}.g4{right:16%;top:64%;animation-delay:2s}
@keyframes twinkle{0%,100%{opacity:.15;scale:.6}50%{opacity:1;scale:1.3}}
@media(max-height:650px){.card{min-height:auto}.sky{height:245px}.sun{top:35px}.hill{height:90px}}
</style>
<body>
<div class="autumn">
<div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div><div class="glow g4"></div>
<main class="wrap"><section class="card">
<div class="falling"><i class="leafdrop fd1"></i><i class="leafdrop fd2"></i><i class="leafdrop fd3"></i><i class="leafdrop fd4"></i><i class="leafdrop fd5"></i></div>
<div class="content">
<div class="date">01 · OCTUBRE</div>
<h1>Bienvenido a<span>Octubre</span></h1>
<p class="lead">Un nuevo mes comienza entre luz dorada, hojas que caen y la belleza de una nueva estación.</p>
<div class="sky"><div class="sun"><i class="ray r1"></i><i class="ray r2"></i><i class="ray r3"></i><i class="ray r4"></i><i class="ray r5"></i><i class="ray r6"></i><i class="ray r7"></i><i class="ray r8"></i></div>
<div class="hill back"></div><div class="hill"></div>
<div class="tree left"><svg viewBox="0 0 145 215" aria-hidden="true">
<path class="trunkShape" d="M64 215C62 184 61 154 63 127C64 108 57 94 50 79C47 72 50 67 56 72C64 79 70 91 73 101C77 83 88 69 104 57C108 54 112 57 109 62C101 75 91 84 86 103C101 89 115 83 129 79C134 78 136 83 132 86C116 96 105 101 94 117C84 132 84 158 87 215Z"/>
<path class="trunkLight" d="M70 215C70 170 69 136 75 110C78 96 87 83 100 68C89 78 81 88 77 104C72 122 76 158 77 215Z"/>
<path class="branchShape" d="M68 122C55 103 42 93 29 84M77 108C87 90 97 76 113 65M75 137C94 121 108 112 127 108"/><path class="branchFine" d="M43 92L31 71M93 84L94 60M105 118L122 96"/>
<g class="foliage">
<g class="leafCluster c1" transform="translate(20 57)"><ellipse rx="30" ry="18" fill="#b94b20"/><ellipse cx="-14" cy="-7" rx="18" ry="13" fill="#d96920"/><ellipse cx="13" cy="-8" rx="18" ry="12" fill="#e18a27"/></g>
<g class="leafCluster c2" transform="translate(51 42)"><ellipse rx="32" ry="20" fill="#e18324"/><ellipse cx="-14" cy="-8" rx="19" ry="13" fill="#c44e1f"/><ellipse cx="15" cy="-9" rx="18" ry="13" fill="#eea12e"/></g>
<g class="leafCluster c3" transform="translate(92 45)"><ellipse rx="31" ry="19" fill="#a83d20"/><ellipse cx="14" cy="-7" rx="19" ry="13" fill="#cf5b1e"/><ellipse cx="-13" cy="-9" rx="18" ry="12" fill="#e68b27"/></g>
<g class="leafCluster c4" transform="translate(119 76)"><ellipse rx="27" ry="18" fill="#d2601f"/><ellipse cx="11" cy="-8" rx="17" ry="12" fill="#e99a2b"/></g>
<g class="leafCluster c5" transform="translate(38 79)"><ellipse rx="26" ry="17" fill="#9f3d20"/><ellipse cx="-10" cy="-7" rx="16" ry="11" fill="#d05a20"/></g>
<g class="leafCluster c6" transform="translate(81 76)"><ellipse rx="30" ry="18" fill="#c34d1e"/><ellipse cx="13" cy="-7" rx="18" ry="12" fill="#df8225"/></g></g></svg></div>
<div class="tree right"><svg viewBox="0 0 145 215" aria-hidden="true">
<path class="trunkShape" d="M64 215C62 184 61 154 63 127C64 108 57 94 50 79C47 72 50 67 56 72C64 79 70 91 73 101C77 83 88 69 104 57C108 54 112 57 109 62C101 75 91 84 86 103C101 89 115 83 129 79C134 78 136 83 132 86C116 96 105 101 94 117C84 132 84 158 87 215Z"/>
<path class="trunkLight" d="M70 215C70 170 69 136 75 110C78 96 87 83 100 68C89 78 81 88 77 104C72 122 76 158 77 215Z"/>
<path class="branchShape" d="M68 122C55 103 42 93 29 84M77 108C87 90 97 76 113 65M75 137C94 121 108 112 127 108"/><path class="branchFine" d="M43 92L31 71M93 84L94 60M105 118L122 96"/>
<g class="foliage">
<g class="leafCluster c1" transform="translate(20 57)"><ellipse rx="30" ry="18" fill="#b94b20"/><ellipse cx="-14" cy="-7" rx="18" ry="13" fill="#d96920"/><ellipse cx="13" cy="-8" rx="18" ry="12" fill="#e18a27"/></g>
<g class="leafCluster c2" transform="translate(51 42)"><ellipse rx="32" ry="20" fill="#e18324"/><ellipse cx="-14" cy="-8" rx="19" ry="13" fill="#c44e1f"/><ellipse cx="15" cy="-9" rx="18" ry="13" fill="#eea12e"/></g>
<g class="leafCluster c3" transform="translate(92 45)"><ellipse rx="31" ry="19" fill="#a83d20"/><ellipse cx="14" cy="-7" rx="19" ry="13" fill="#cf5b1e"/><ellipse cx="-13" cy="-9" rx="18" ry="12" fill="#e68b27"/></g>
<g class="leafCluster c4" transform="translate(119 76)"><ellipse rx="27" ry="18" fill="#d2601f"/><ellipse cx="11" cy="-8" rx="17" ry="12" fill="#e99a2b"/></g>
<g class="leafCluster c5" transform="translate(38 79)"><ellipse rx="26" ry="17" fill="#9f3d20"/><ellipse cx="-10" cy="-7" rx="16" ry="11" fill="#d05a20"/></g>
<g class="leafCluster c6" transform="translate(81 76)"><ellipse rx="30" ry="18" fill="#c34d1e"/><ellipse cx="13" cy="-7" rx="18" ry="12" fill="#df8225"/></g></g></svg></div>
<div class="flower f1"><svg viewBox="0 0 60 60"><g transform="translate(30 28)"><g fill="#f5a52f"><ellipse rx="7" ry="22"/><ellipse rx="7" ry="22" transform="rotate(45)"/><ellipse rx="7" ry="22" transform="rotate(90)"/><ellipse rx="7" ry="22" transform="rotate(135)"/></g><circle r="9" fill="#bd541d"/><circle r="4" fill="#ffd267"/></g></svg></div>
<div class="flower f2"><svg viewBox="0 0 60 60"><g transform="translate(30 28)"><g fill="#fff0c5"><ellipse rx="6" ry="19"/><ellipse rx="6" ry="19" transform="rotate(60)"/><ellipse rx="6" ry="19" transform="rotate(120)"/></g><circle r="7" fill="#e58c27"/></g></svg></div>
<div class="flower f3"><svg viewBox="0 0 60 60"><g transform="translate(30 28)"><g fill="#e87828"><ellipse rx="7" ry="21"/><ellipse rx="7" ry="21" transform="rotate(45)"/><ellipse rx="7" ry="21" transform="rotate(90)"/><ellipse rx="7" ry="21" transform="rotate(135)"/></g><circle r="8" fill="#9e3c1c"/></g></svg></div>
<div class="ground"></div></div>
<div class="separator"></div>
<div class="welcome"><div class="welcome-top"><div class="icon"><svg width="25" height="25" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M5 9l14 6M19 9L5 15" stroke="#fff4d5" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="8" r="3.3" fill="#fff4d5"/></svg></div>
<div><div class="w-title">Comienza un nuevo mes</div><div class="w-sub">Octubre llega con una nueva energía.</div></div><div class="pill">01 OCT</div></div>
<div class="copy"><p><strong>Que octubre llegue con luz, calma y nuevos momentos.</strong><br>Que cada hoja que cae recuerde que también hay belleza en cambiar, crecer y comenzar de nuevo.</p></div></div>
<div class="signature">BIENVENIDO · OCTUBRE · 2026</div>
</div></section></main></div></body>`

  const html = htmlBase
    .replaceAll('01 · OCTUBRE', `${dia} · ${mesMayus}`)
    .replaceAll('01 OCT', `${dia} ${mesMayus}`)
    .replaceAll('Octubre', mesCap)
    .replaceAll('octubre', mes)
    .replaceAll('2026', año)

  const response = {
    response_id: '4db57b2c-8393-484d-8b9a-8e6d1a14b349',
    sections: [{
      view_model: {
        primitive: {
          __typename: 'GenAIaeacdsnwHtmlPrimitive',
          payload: html,
          trusted_sources: ['nixel.dev']
        },
        __typename: 'GenAISingleLayoutViewModel'
      }
    }]
  }

  await conn.relayMessage(m.chat, {
    messageContextInfo: {
      deviceListMetadata: {},
      deviceListMetadataVersion: 2,
      botMetadata: {
        messageDisclaimerText: '',
        botResponseId: 'b2e40280-433c-45d8-9c1a-270bec558860',
        verificationMetadata: {
          proofs: [{
            version: 1,
            useCase: 1,
            signature: 'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==',
            certificateChain: [
              'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg',
              'TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ=='
            ]
          }]
        }
      }
    },
    botForwardedMessage: {
      message: {
        richResponseMessage: {
          messageType: 1,
          submessages: [{
            messageType: 2,
            messageText: `Bienvenido a ${mesCap}`
          }],
          unifiedResponse: {
            data: Buffer.from(JSON.stringify(response)).toString('base64')
          },
          contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedAiBotMessageInfo: {
              botJid: '867051314767696@bot'
            },
            forwardOrigin: 4
          }
        }
      }
    }
  }, {})
}

handler.command = ['cal']
//handler.owner = true

export default handler
