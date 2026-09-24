import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

let userMessageCount = {}

let flags = [
  {"name": "Afganistán","code": "AF","emoji": "🇦🇫","dialCodes": ["+93"],"slug": "afghanistan"},
  {"name": "Albania","code": "AL","emoji": "🇦🇱","dialCodes": ["+355"],"slug": "albania"},
  {"name": "Andorra","code": "AD","emoji": "🇦🇩","dialCodes": ["+376"],"slug": "andorra"},
  {"name": "Angola","code": "AO","emoji": "🇦🇴","dialCodes": ["+244"],"slug": "angola"},
  {"name": "Anguila","code": "AI","emoji": "🇦🇮","dialCodes": ["+1264"],"slug": "anguilla"},
  {"name": "Antarctica","code": "AQ","emoji": "🇦🇶","dialCodes": ["+672"],"slug": "antarctica"},
  {"name": "Antigua y Barbuda","code": "AG","emoji": "🇦🇬","dialCodes": ["+1268"],"slug": "antigua-and-barbuda"},
  {"name": "Argentina","code": "AR","emoji": "🇦🇷","dialCodes": ["+54"],"slug": "argentina"},
  {"name": "Armenia","code": "AM","emoji": "🇦🇲","dialCodes": ["+374"],"slug": "armenia"},
  {"name": "Aruba","code": "AW","emoji": "🇦🇼","dialCodes": ["+297"],"slug": "aruba"},
  {"name": "Islas Ascensión","code": "AC","emoji": "🇦🇨","slug": "ascension-island"},
  {"name": "Australia","code": "AU","emoji": "🇦🇺","dialCodes": ["+61"],"slug": "australia"},
  {"name": "Austria","code": "AT","emoji": "🇦🇹","dialCodes": ["+43"],"slug": "austria"},
  {"name": "Azerbaiyán","code": "AZ","emoji": "🇦🇿","dialCodes": ["+994"],"slug": "azerbaijan"},
  {"name": "Bahamas","code": "BS","emoji": "🇧🇸","dialCodes": ["+1242"],"slug": "bahamas"},
  {"name": "Baréin","code": "BH","emoji": "🇧🇭","dialCodes": ["+973"],"slug": "bahrain"},
  {"name": "Bangladés","code": "BD","emoji": "🇧🇩","dialCodes": ["+880"],"slug": "bangladesh"},
  {"name": "Barbados","code": "BB","emoji": "🇧🇧","dialCodes": ["+1246"],"slug": "barbados"},
  {"name": "Bielorrusia","code": "BY","emoji": "🇧🇾","dialCodes": ["+375"],"slug": "belarus"},
  {"name": "Bélgica","code": "BE","emoji": "🇧🇪","dialCodes": ["+32"],"slug": "belgium"},
  {"name": "Belice","code": "BZ","emoji": "🇧🇿","dialCodes": ["+501"],"slug": "belize"},
  {"name": "Benin","code": "BJ","emoji": "🇧🇯","dialCodes": ["+229"],"slug": "benin"},
  {"name": "Bermuda","code": "BM","emoji": "🇧🇲","dialCodes": ["+1441"],"slug": "bermuda"},
  {"name": "Bután","code": "BT","emoji": "🇧🇹","dialCodes": ["+975"],"slug": "bhutan"},
  {"name": "Bolivia","code": "BO","emoji": "🇧🇴","dialCodes": ["+591"],"slug": "bolivia"},
  {"name": "Bosnia y Herzegovina","code": "BA","emoji": "🇧🇦","dialCodes": ["+387"],"slug": "bosnia-and-herzegovina"},
  {"name": "Botsuana","code": "BW","emoji": "🇧🇼","dialCodes": ["+267"],"slug": "botswana"},
  {"name": "Brasil","code": "BR","emoji": "🇧🇷","dialCodes": ["+55"],"slug": "brazil"},
  {"name": "Territorio Británico del Océano Índico","code": "IO","emoji": "🇮🇴","slug": "british-indian-ocean-territory"},
  {"name": "Brunei","code": "BN","emoji": "🇧🇳","dialCodes": ["+673"],"slug": "brunei"},
  {"name": "Bulgaria","code": "BG","emoji": "🇧🇬","dialCodes": ["+359"],"slug": "bulgaria"},
  {"name": "Burkina Faso","code": "BF","emoji": "🇧🇫","dialCodes": ["+226"],"slug": "burkina-faso"},
  {"name": "Burundi","code": "BI","emoji": "🇧🇮","dialCodes": ["+257"],"slug": "burundi"},
  {"name": "Cabo Verde","code": "CV","emoji": "🇨🇻","dialCodes": ["+238"],"slug": "cabo-verde"},
  {"name": "Camboya","code": "KH","emoji": "🇰🇭","dialCodes": ["+855"],"slug": "cambodia"},
  {"name": "Camerún","code": "CM","emoji": "🇨🇲","dialCodes": ["+237"],"slug": "cameroon"},
  {"name": "Canadá","code": "CA","emoji": "🇨🇦","dialCodes": ["+1"],"slug": "canada"},
  {"name": "Islas Caimán","code": "KY","emoji": "🇰🇾","dialCodes": ["+1345"],"slug": "cayman-islands"},
  {"name": "República Centroafricana","code": "CF","emoji": "🇨🇫","dialCodes": ["+236"],"slug": "central-african-republic"},
  {"name": "Chad","code": "TD","emoji": "🇹🇩","dialCodes": ["+235"],"slug": "chad"},
  {"name": "Chile","code": "CL","emoji": "🇨🇱","dialCodes": ["+56"],"slug": "chile"},
  {"name": "China","code": "CN","emoji": "🇨🇳","dialCodes": ["+86"],"slug": "china"},
  {"name": "Isla de Navidad","code": "CX","emoji": "🇨🇽","slug": "christmas-island"},
  {"name": "Islas Cocos (Keeling)","code": "CC","emoji": "🇨🇨","slug": "cocos-(keeling)-islands"},
  {"name": "Colombia","code": "CO","emoji": "🇨🇴","dialCodes": ["+57"],"slug": "colombia"},
  {"name": "Comoros","code": "KM","emoji": "🇰🇲","dialCodes": ["+269"],"slug": "comoros"},
  {"name": "Congo - Brazzaville","code": "CG","emoji": "🇨🇬","dialCodes": ["+242"],"slug": "congo-brazzaville"},
  {"name": "Congo - Kinshasa","code": "CD","emoji": "🇨🇩","dialCodes": ["+243"],"slug": "congo-kinshasa"},
  {"name": "Islas Cook","code": "CK","emoji": "🇨🇰","dialCodes": ["+682"],"slug": "cook-islands"},
  {"name": "Costa Rica","code": "CR","emoji": "🇨🇷","dialCodes": ["+506"],"slug": "costa-rica"},
  {"name": "Croacia","code": "HR","emoji": "🇭🇷","dialCodes": ["+385"],"slug": "croatia"},
  {"name": "Cuba","code": "CU","emoji": "🇨🇺","dialCodes": ["+53"],"slug": "cuba"},
  {"name": "Curaçao","code": "CW","emoji": "🇨🇼","dialCodes": ["+599"],"slug": "curacao"},
  {"name": "Chipre","code": "CY","emoji": "🇨🇾","dialCodes": ["+357"],"slug": "cyprus"},
  {"name": "República Checa","code": "CZ","emoji": "🇨🇿","dialCodes": ["+420"],"slug": "czechia"},
  {"name": "Costa de Marfil","code": "CI","emoji": "🇨🇮","dialCodes": ["+225"],"slug": "cote-d'ivoire"},
  {"name": "Dinamarca","code": "DK","emoji": "🇩🇰","dialCodes": ["+45"],"slug": "denmark"},
  {"name": "Yibuti","code": "DJ","emoji": "🇩🇯","dialCodes": ["+253"],"slug": "djibouti"},
  {"name": "Dominica","code": "DM","emoji": "🇩🇲","dialCodes": ["+1767"],"slug": "dominica"},
  {"name": "República Dominicana","code": "DO","emoji": "🇩🇴","dialCodes": ["+1 809","+1 829","+1 849"],"slug": "dominican-republic"},
  {"name": "Ecuador","code": "EC","emoji": "🇪🇨","dialCodes": ["+593"],"slug": "ecuador"},
  {"name": "Egipto","code": "EG","emoji": "🇪🇬","dialCodes": ["+20"],"slug": "egypt"},
  {"name": "El Salvador","code": "SV","emoji": "🇸🇻","dialCodes": ["+503"],"slug": "el-salvador"},
  {"name": "Guinea Ecuatorial","code": "GQ","emoji": "🇬🇶","dialCodes": ["+240"],"slug": "equatorial-guinea"},
  {"name": "Eritrea","code": "ER","emoji": "🇪🇷","dialCodes": ["+291"],"slug": "eritrea"},
  {"name": "Estonia","code": "EE","emoji": "🇪🇪","dialCodes": ["+372"],"slug": "estonia"},
  {"name": "Eswatini","code": "SZ","emoji": "🇸🇿","dialCodes": ["+268"],"slug": "eswatini"},
  {"name": "Etiopía","code": "ET","emoji": "🇪🇹","dialCodes": ["+251"],"slug": "ethiopia"},
  {"name": "Islas Malvinas","code": "FK","emoji": "🇫🇰","dialCodes": ["+500"],"slug": "falkland-islands"},
  {"name": "Islas Feroe","code": "FO","emoji": "🇫🇴","dialCodes": ["+298"],"slug": "faroe-islands"},
  {"name": "Fiyi","code": "FJ","emoji": "🇫🇯","dialCodes": ["+679"],"slug": "fiji"},
  {"name": "Finlandia","code": "FI","emoji": "🇫🇮","dialCodes": ["+358"],"slug": "finland"},
  {"name": "Francia","code": "FR","emoji": "🇫🇷","dialCodes": ["+33"],"slug": "france"},
  {"name": "Guayana Francesa","code": "GF","emoji": "🇬🇫","dialCodes": ["+594"],"slug": "french-guiana"},
  {"name": "Polinesia Francesa","code": "PF","emoji": "🇵🇫","dialCodes": ["+689"],"slug": "french-polynesia"},
  {"name": "Territorios Australes Franceses","code": "TF","emoji": "🇹🇫","slug": "french-southern-territories"},
  {"name": "Gabon","code": "GA","emoji": "🇬🇦","dialCodes": ["+241"],"slug": "gabon"},
  {"name": "Gambia","code": "GM","emoji": "🇬🇲","dialCodes": ["+220"],"slug": "gambia"},
  {"name": "Georgia","code": "GE","emoji": "🇬🇪","dialCodes": ["+995"],"slug": "georgia"},
  {"name": "Alemania","code": "DE","emoji": "🇩🇪","dialCodes": ["+49"],"slug": "germany"},
  {"name": "Ghana","code": "GH","emoji": "🇬🇭","dialCodes": ["+233"],"slug": "ghana"},
  {"name": "Gibraltar","code": "GI","emoji": "🇬🇮","dialCodes": ["+350"],"slug": "gibraltar"},
  {"name": "Grecia","code": "GR","emoji": "🇬🇷","dialCodes": ["+30"],"slug": "greece"},
  {"name": "Groenlandia","code": "GL","emoji": "🇬🇱","dialCodes": ["+299"],"slug": "greenland"},
  {"name": "Granada","code": "GD","emoji": "🇬🇩","dialCodes": ["+1473"],"slug": "grenada"},
  {"name": "Guadalupe","code": "GP","emoji": "🇬🇵","dialCodes": ["+590"],"slug": "guadeloupe"},
  {"name": "Guam","code": "GU","emoji": "🇬🇺","dialCodes": ["+1671"],"slug": "guam"},
  {"name": "Guatemala","code": "GT","emoji": "🇬🇹","dialCodes": ["+502"],"slug": "guatemala"},
  {"name": "Guernsey","code": "GG","emoji": "🇬🇬","dialCodes": ["+44"],"slug": "guernsey"},
  {"name": "Guinea","code": "GN","emoji": "🇬🇳","dialCodes": ["+224"],"slug": "guinea"},
  {"name": "Guinea-Bisáu","code": "GW","emoji": "🇬🇼","dialCodes": ["+245"],"slug": "guinea-bissau"},
  {"name": "Guyana","code": "GY","emoji": "🇬🇾","dialCodes": ["+592"],"slug": "guyana"},
  {"name": "Haití","code": "HT","emoji": "🇭🇹","dialCodes": ["+509"],"slug": "haiti"},
  {"name": "Islas Heard y McDonald","code": "HM","emoji": "🇭🇲","slug": "heard-and-mcdonald-islands"},
  {"name": "Honduras","code": "HN","emoji": "🇭🇳","dialCodes": ["+504"],"slug": "honduras"},
  {"name": "Hong Kong","code": "HK","emoji": "🇭🇰","dialCodes": ["+852"],"slug": "hong-kong-sar-china"},
  {"name": "Hungría","code": "HU","emoji": "🇭🇺","dialCodes": ["+36"],"slug": "hungary"},
  {"name": "Islandia","code": "IS","emoji": "🇮🇸","dialCodes": ["+354"],"slug": "iceland"},
  {"name": "India","code": "IN","emoji": "🇮🇳","dialCodes": ["+91"],"slug": "india"},
  {"name": "Indonesia","code": "ID","emoji": "🇮🇩","dialCodes": ["+62"],"slug": "indonesia"},
  {"name": "Irán","code": "IR","emoji": "🇮🇷","dialCodes": ["+98"],"slug": "iran"},
  {"name": "Iraq","code": "IQ","emoji": "🇮🇶","dialCodes": ["+964"],"slug": "iraq"},
  {"name": "Irlanda","code": "IE","emoji": "🇮🇪","dialCodes": ["+353"],"slug": "ireland"},
  {"name": "Isla de Man","code": "IM","emoji": "🇮🇲","dialCodes": ["+44"],"slug": "isle-of-man"},
  {"name": "Israel","code": "IL","emoji": "🇮🇱","dialCodes": ["+972"],"slug": "israel"},
  {"name": "Italia","code": "IT","emoji": "🇮🇹","dialCodes": ["+39"],"slug": "italy"},
  {"name": "Jamaica","code": "JM","emoji": "🇯🇲","dialCodes": ["+1 876"],"slug": "jamaica"},
  {"name": "Japón","code": "JP","emoji": "🇯🇵","dialCodes": ["+81"],"slug": "japan"},
  {"name": "Jersey","code": "JE","emoji": "🇯🇪","dialCodes": ["+44"],"slug": "jersey"},
  {"name": "Jordan","code": "JO","emoji": "🇯🇴","dialCodes": ["+962"],"slug": "jordan"},
  {"name": "Kazajistán","code": "KZ","emoji": "🇰🇿","dialCodes": ["+7"],"slug": "kazakhstan"},
  {"name": "Kenia","code": "KE","emoji": "🇰🇪","dialCodes": ["+254"],"slug": "kenya"},
  {"name": "Kiribati","code": "KI","emoji": "🇰🇮","dialCodes": ["+686"],"slug": "kiribati"},
  {"name": "Kosovo","code": "XK","emoji": "🇽🇰","dialCodes": ["+383"],"slug": "kosovo"},
  {"name": "Kuwait","code": "KW","emoji": "🇰🇼","dialCodes": ["+965"],"slug": "kuwait"},
  {"name": "Kirguistán","code": "KG","emoji": "🇰🇬","dialCodes": ["+996"],"slug": "kyrgyzstan"},
  {"name": "Laos","code": "LA","emoji": "🇱🇦","dialCodes": ["+856"],"slug": "laos"},
  {"name": "Letonia","code": "LV","emoji": "🇱🇻","dialCodes": ["+371"],"slug": "latvia"},
  {"name": "Líbano","code": "LB","emoji": "🇱🇧","dialCodes": ["+961"],"slug": "lebanon"},
  {"name": "Lesoto","code": "LS","emoji": "🇱🇸","dialCodes": ["+266"],"slug": "lesotho"},
  {"name": "Liberia","code": "LR","emoji": "🇱🇷","dialCodes": ["+231"],"slug": "liberia"},
  {"name": "Libia","code": "LY","emoji": "🇱🇾","dialCodes": ["+218"],"slug": "libya"},
  {"name": "Liechtenstein","code": "LI","emoji": "🇱🇮","dialCodes": ["+423"],"slug": "liechtenstein"},
  {"name": "Lituania","code": "LT","emoji": "🇱🇹","dialCodes": ["+370"],"slug": "lithuania"},
  {"name": "Luxemburgo","code": "LU","emoji": "🇱🇺","dialCodes": ["+352"],"slug": "luxembourg"},
  {"name": "Macao","code": "MO","emoji": "🇲🇴","dialCodes": ["+853"],"slug": "macao-sar-china"},
  {"name": "Madagascar","code": "MG","emoji": "🇲🇬","dialCodes": ["+261"],"slug": "madagascar"},
  {"name": "Malawi","code": "MW","emoji": "🇲🇼","dialCodes": ["+265"],"slug": "malawi"},
  {"name": "Malasia","code": "MY","emoji": "🇲🇾","dialCodes": ["+60"],"slug": "malaysia"},
  {"name": "Maldivas","code": "MV","emoji": "🇲🇻","dialCodes": ["+960"],"slug": "maldives"},
  {"name": "Mali","code": "ML","emoji": "🇲🇱","dialCodes": ["+223"],"slug": "mali"},
  {"name": "Malta","code": "MT","emoji": "🇲🇹","dialCodes": ["+356"],"slug": "malta"},
  {"name": "Islas Marshall ","code": "MH","emoji": "🇲🇭","dialCodes": ["+692"],"slug": "marshall-islands"},
  {"name": "Martinica","code": "MQ","emoji": "🇲🇶","dialCodes": ["+596"],"slug": "martinique"},
  {"name": "Mauritania","code": "MR","emoji": "🇲🇷","dialCodes": ["+222"],"slug": "mauritania"},
  {"name": "Mauricio","code": "MU","emoji": "🇲🇺","dialCodes": ["+230"],"slug": "mauritius"},
  {"name": "Mayotte","code": "YT","emoji": "🇾🇹","dialCodes": ["+262"],"slug": "mayotte"},
  {"name": "Mexico","code": "MX","emoji": "🇲🇽","dialCodes": ["+52"],"slug": "mexico"},
  {"name": "Micronesia","code": "FM","emoji": "🇫🇲","dialCodes": ["+691"],"slug": "micronesia"},
  {"name": "Moldavia","code": "MD","emoji": "🇲🇩","dialCodes": ["+373"],"slug": "moldova"},
  {"name": "Mónaco","code": "MC","emoji": "🇲🇨","dialCodes": ["+377"],"slug": "monaco"},
  {"name": "Mongolia","code": "MN","emoji": "🇲🇳","dialCodes": ["+976"],"slug": "mongolia"},
  {"name": "Montenegro","code": "ME","emoji": "🇲🇪","dialCodes": ["+382"],"slug": "montenegro"},
  {"name": "Montserrat","code": "MS","emoji": "🇲🇸","dialCodes": ["+1 664"],"slug": "montserrat"},
  {"name": "Marruecos","code": "MA","emoji": "🇲🇦","dialCodes": ["+212"],"slug": "morocco"},
  {"name": "Mozambique","code": "MZ","emoji": "🇲🇿","dialCodes": ["+258"],"slug": "mozambique"},
  {"name": "Myanmar","code": "MM","emoji": "🇲🇲","dialCodes": ["+95"],"slug": "myanmar-(burma)"},
  {"name": "Namibia","code": "NA","emoji": "🇳🇦","dialCodes": ["+264"],"slug": "namibia"},
  {"name": "Nauru","code": "NR","emoji": "🇳🇷","dialCodes": ["+674"],"slug": "nauru"},
  {"name": "Nepal","code": "NP","emoji": "🇳🇵","dialCodes": ["+977"],"slug": "nepal"},
  {"name": "Países Bajos","code": "NL","emoji": "🇳🇱","dialCodes": ["+31"],"slug": "netherlands"},
  {"name": "Nueva Caledonia","code": "NC","emoji": "🇳🇨","dialCodes": ["+687"],"slug": "new-caledonia"},
  {"name": "Nueva Zelanda","code": "NZ","emoji": "🇳🇿","dialCodes": ["+64"],"slug": "new-zealand"},
  {"name": "Nicaragua","code": "NI","emoji": "🇳🇮","dialCodes": ["+505"],"slug": "nicaragua"},
  {"name": "Niger","code": "NE","emoji": "🇳🇪","dialCodes": ["+227"],"slug": "niger"},
  {"name": "Nigeria","code": "NG","emoji": "🇳🇬","dialCodes": ["+234"],"slug": "nigeria"},
  {"name": "Niue","code": "NU","emoji": "🇳🇺","dialCodes": ["+683"],"slug": "niue"},
  {"name": "Isla Norfolk","code": "NF","emoji": "🇳🇫","dialCodes": ["+672"],"slug": "norfolk-island"},
  {"name": "Corea del Norte","code": "KP","emoji": "🇰🇵","dialCodes": ["+850"],"slug": "north-korea"},
  {"name": "Islas Marianas del Norte","code": "MP","emoji": "🇲🇵","dialCodes": ["+1 670"],"slug": "northern-mariana-islands"},
  {"name": "Noruega","code": "NO","emoji": "🇳🇴","dialCodes": ["+47"],"slug": "norway"},
  {"name": "Oman","code": "OM","emoji": "🇴🇲","dialCodes": ["+968"],"slug": "oman"},
  {"name": "Pakistán","code": "PK","emoji": "🇵🇰","dialCodes": ["+92"],"slug": "pakistan"},
  {"name": "Palau","code": "PW","emoji": "🇵🇼","dialCodes": ["+680"],"slug": "palau"},
  {"name": "Territorios Palestinos","code": "PS","emoji": "🇵🇸","dialCodes": ["+970"],"slug": "palestinian-territories"},
  {"name": "Panamá","code": "PA","emoji": "🇵🇦","dialCodes": ["+507"],"slug": "panama"},
  {"name": "Papúa Nueva Guinea","code": "PG","emoji": "🇵🇬","dialCodes": ["+675"],"slug": "papua-new-guinea"},
  {"name": "Paraguay","code": "PY","emoji": "🇵🇾","dialCodes": ["+595"],"slug": "paraguay"},
  {"name": "Perú","code": "PE","emoji": "🇵🇪","dialCodes": ["+51"],"slug": "peru"},
  {"name": "Filipinas","code": "PH","emoji": "🇵🇭","dialCodes": ["+63"],"slug": "philippines"},
  {"name": "Islas Pitcairn","code": "PN","emoji": "🇵🇳","dialCodes": ["+64"],"slug": "pitcairn-islands"},
  {"name": "Polonia","code": "PL","emoji": "🇵🇱","dialCodes": ["+48"],"slug": "poland"},
  {"name": "Portugal","code": "PT","emoji": "🇵🇹","dialCodes": ["+351"],"slug": "portugal"},
  {"name": "Puerto Rico","code": "PR","emoji": "🇵🇷","dialCodes": ["+1 787"],"slug": "puerto-rico"},
  {"name": "Qatar","code": "QA","emoji": "🇶🇦","dialCodes": ["+974"],"slug": "qatar"},
  {"name": "Reunión","code": "RE","emoji": "🇷🇪","dialCodes": ["+262"],"slug": "reunion"},
  {"name": "Rumania","code": "RO","emoji": "🇷🇴","dialCodes": ["+40"],"slug": "romania"},
  {"name": "Rusia","code": "RU","emoji": "🇷🇺","dialCodes": ["+7"],"slug": "russia"},
  {"name": "Ruanda","code": "RW","emoji": "🇷🇼","dialCodes": ["+250"],"slug": "rwanda"},
  {"name": "San Bartolomé","code": "BL","emoji": "🇧🇱","slug": "saint-barthelemy"},
  {"name": "Santa Helena","code": "SH","emoji": "🇸🇭","dialCodes": ["+290"],"slug": "saint-helena"},
  {"name": "San Cristóbal y Nieves","code": "KN","emoji": "🇰🇳","dialCodes": ["+1 869"],"slug": "saint-kitts-and-nevis"},
  {"name": "Santa Lucía","code": "LC","emoji": "🇱🇨","dialCodes": ["+1 758"],"slug": "saint-lucia"},
  {"name": "San Martín","code": "MF","emoji": "🇲🇫","slug": "saint-martin"},
  {"name": "San Pedro y Miquelón","code": "PM","emoji": "🇵🇲","dialCodes": ["+508"],"slug": "saint-pierre-and-miquelon"},
  {"name": "Samoa","code": "WS","emoji": "🇼🇸","dialCodes": ["+685"],"slug": "samoa"},
  {"name": "San Marino","code": "SM","emoji": "🇸🇲","dialCodes": ["+378"],"slug": "san-marino"},
  {"name": "Santo Tomé y Príncipe","code": "ST","emoji": "🇸🇹","dialCodes": ["+239"],"slug": "sao-tome-and-principe"},
  {"name": "Arabia Saudita","code": "SA","emoji": "🇸🇦","dialCodes": ["+966"],"slug": "saudi-arabia"},
  {"name": "Senegal","code": "SN","emoji": "🇸🇳","dialCodes": ["+221"],"slug": "senegal"},
  {"name": "Serbia","code": "RS","emoji": "🇷🇸","dialCodes": ["+381"],"slug": "serbia"},
  {"name": "Seychelles","code": "SC","emoji": "🇸🇨","dialCodes": ["+248"],"slug": "seychelles"},
  {"name": "Sierra Leona","code": "SL","emoji": "🇸🇱","dialCodes": ["+232"],"slug": "sierra-leone"},
  {"name": "Singapur","code": "SG","emoji": "🇸🇬","dialCodes": ["+65"],"slug": "singapore"},
  {"name": "Sint Maarten","code": "SX","emoji": "🇸🇽","dialCodes": ["+1 721"],"slug": "sint-maarten"},
  {"name": "Eslovaquia","code": "SK","emoji": "🇸🇰","dialCodes": ["+421"],"slug": "slovakia"},
  {"name": "Eslovenia","code": "SI","emoji": "🇸🇮","dialCodes": ["+386"],"slug": "slovenia"},
  {"name": "Islas Salomón","code": "SB","emoji": "🇸🇧","dialCodes": ["+677"],"slug": "solomon-islands"},
  {"name": "Somalia","code": "SO","emoji": "🇸🇴","dialCodes": ["+252"],"slug": "somalia"},
  {"name": "Sudáfrica","code": "ZA","emoji": "🇿🇦","dialCodes": ["+27"],"slug": "south-africa"},
  {"name": "Georgia del Sur","code": "GS","emoji": "🇬🇸","slug": "south-georgia-and-south-sandwich-islands"},
  {"name": "Corea del Sur","code": "KR","emoji": "🇰🇷","dialCodes": ["+82"],"slug": "south-korea"},
  {"name": "Sudán del Sur","code": "SS","emoji": "🇸🇸","dialCodes": ["+211"],"slug": "south-sudan"},
  {"name": "España","code": "ES","emoji": "🇪🇸","dialCodes": ["+34"],"slug": "spain"},
  {"name": "Sri Lanka","code": "LK","emoji": "🇱🇰","dialCodes": ["+94"],"slug": "sri-lanka"},
  {"name": "Sudan","code": "SD","emoji": "🇸🇩","dialCodes": ["+249"],"slug": "sudan"},
  {"name": "Surinam","code": "SR","emoji": "🇸🇷","dialCodes": ["+597"],"slug": "suriname"},
  {"name": "Svalbard y Jan Mayen","code": "SJ","emoji": "🇸🇯","slug": "svalbard-and-jan-mayen"},
  {"name": "Suecia","code": "SE","emoji": "🇸🇪","dialCodes": ["+46"],"slug": "sweden"},
  {"name": "Suiza","code": "CH","emoji": "🇨🇭","dialCodes": ["+41"],"slug": "switzerland"},
  {"name": "Siria","code": "SY","emoji": "🇸🇾","dialCodes": ["+963"],"slug": "syria"},
  {"name": "Taiwán","code": "TW","emoji": "🇹🇼","dialCodes": ["+886"],"slug": "taiwan"},
  {"name": "Tayikistán","code": "TJ","emoji": "🇹🇯","dialCodes": ["+992"],"slug": "tajikistan"},
  {"name": "Tanzania","code": "TZ","emoji": "🇹🇿","dialCodes": ["+255"],"slug": "tanzania"},
  {"name": "Tailandia","code": "TH","emoji": "🇹🇭","dialCodes": ["+66"],"slug": "thailand"},
  {"name": "Timor Oriental","code": "TL","emoji": "🇹🇱","dialCodes": ["+670"],"slug": "timor-leste"},
  {"name": "Togo","code": "TG","emoji": "🇹🇬","dialCodes": ["+228"],"slug": "togo"},
  {"name": "Tokelau","code": "TK","emoji": "🇹🇰","dialCodes": ["+690"],"slug": "tokelau"},
  {"name": "Tonga","code": "TO","emoji": "🇹🇴","dialCodes": ["+676"],"slug": "tonga"},
  {"name": "Trinidad y Tobago","code": "TT","emoji": "🇹🇹","dialCodes": ["+1 868"],"slug": "trinidad-and-tobago"},
  {"name": "Túnez","code": "TN","emoji": "🇹🇳","dialCodes": ["+216"],"slug": "tunisia"},
  {"name": "Turquía","code": "TR","emoji": "🇹🇷","dialCodes": ["+90"],"slug": "turkey"},
  {"name": "Turkmenistán","code": "TM","emoji": "🇹🇲","dialCodes": ["+993"],"slug": "turkmenistan"},
  {"name": "Islas Turcas","code": "TC","emoji": "🇹🇨","dialCodes": ["+1 649"],"slug": "turks-and-caicos-islands"},
  {"name": "Tuvalu","code": "TV","emoji": "🇹🇻","dialCodes": ["+688"],"slug": "tuvalu"},
  {"name": "Uganda","code": "UG","emoji": "🇺🇬","dialCodes": ["+256"],"slug": "uganda"},
  {"name": "Ucrania","code": "UA","emoji": "🇺🇦","dialCodes": ["+380"],"slug": "ukraine"},
  {"name": "Emiratos Árabes Unidos","code": "AE","emoji": "🇦🇪","dialCodes": ["+971"],"slug": "united-arab-emirates"},
  {"name": "Reino Unido","code": "GB","emoji": "🇬🇧","dialCodes": ["+44"],"slug": "united-kingdom"},
  {"name": "Estados Unidos","code": "US","emoji": "🇺🇸","dialCodes": ["+1"],"slug": "united-states"},
  {"name": "Uruguay","code": "UY","emoji": "🇺🇾","dialCodes": ["+598"],"slug": "uruguay"},
  {"name": "Uzbekistan","code": "UZ","emoji": "🇺🇿","dialCodes": ["+998"],"slug": "uzbekistan"},
  {"name": "Vanuatu","code": "VU","emoji": "🇻🇺","dialCodes": ["+678"],"slug": "vanuatu"},
  {"name": "Ciudad del Vaticano","code": "VA","emoji": "🇻🇦","dialCodes": ["+379"],"slug": "vatican-city"},
  {"name": "Venezuela","code": "VE","emoji": "🇻🇪","dialCodes": ["+58"],"slug": "venezuela"},
  {"name": "Vietnam","code": "VN","emoji": "🇻🇳","dialCodes": ["+84"],"slug": "vietnam"},
  {"name": "Yemen","code": "YE","emoji": "🇾🇪","dialCodes": ["+967"],"slug": "yemen"},
  {"name": "Wallis y Futuna","code": "WF","emoji": "🇼🇫","dialCodes": ["+681"],"slug": "wallis-and-futuna"}
];

async function flagToImage(flag) {
  try {
    const codepoints = [...flag.emoji]
      .map(char =>
        char.codePointAt(0).toString(16)
      )
      .join('-')
    const twemojiPackage = path.dirname(
      require.resolve('twemoji/package.json')
    )


    const svgPath = path.join(
      twemojiPackage,
      'assets',
      'svg',
      `${codepoints}.svg`
    )


    console.log(
      `🌍 Generando bandera: ${flag.name} ${flag.emoji}`
    )

    console.log(
      `🔎 Código Twemoji: ${codepoints}`
    )

    console.log(
      `📁 SVG: ${svgPath}`
    )


    if (!fs.existsSync(svgPath)) {
      throw new Error(
        `No se encontró el SVG de Twemoji para ${flag.name}: ${svgPath}`
      )
    }
    const svgBuffer =
      fs.readFileSync(svgPath)

    const buffer =
      await sharp(svgBuffer)
        .resize(800, 500, {
          fit: 'contain',
          background: {
            r: 255,
            g: 255,
            b: 255,
            alpha: 1
          }
        })
        .png()
        .toBuffer()


    console.log(
      `✅ Bandera generada: ${flag.name}`
    )

    console.log(
      `🖼️ PNG: ${buffer.length} bytes`
    )


    return buffer

  } catch (error) {

    console.error(
      `❌ Error generando la bandera ${flag.name}:`,
      error
    )

    throw error
  }
}


export async function before(
  m,
  { conn, args, usedPrefix, command }
) {

  let chat = db.data.chats[m.chat]


  if (!chat.autoband || !m.isGroup) return !0
  if (!m.message) return !0


  if (!userMessageCount[m.chat]) {

    userMessageCount[m.chat] = {
      count: 0,
      currentFlag: null,
      currentFlag2: null,
      currentFlag3: null,
      questionMessage: null,
      timestamp: null
    }

  }


  userMessageCount[m.chat].count += 1


  if (
    userMessageCount[m.chat].count % 5 === 0
  ) {

    const randomFlag =
      flags[
        Math.floor(
          Math.random() * flags.length
        )
      ]


    userMessageCount[m.chat].currentFlag =
      randomFlag.name


    userMessageCount[m.chat].currentFlag2 =
      randomFlag.emoji


    userMessageCount[m.chat].currentFlag3 =
      randomFlag.dialCodes ||
      'DESCONOCIDO'
    const txt = `💣 *¿A qué país pertenece la bandera que se muestra?*

_🤖 Por favor, responda a este mensaje con la respuesta correcta en un plazo de *3 minutos*._`


    try {

      console.log(
        `🌍 Preparando desafío: ${randomFlag.name} ${randomFlag.emoji}`
      )
      const buffer =
        await flagToImage(randomFlag)


      console.log(
        `🖼️ Imagen lista: ${buffer.length} bytes`
      )
      userMessageCount[m.chat].questionMessage =
        await conn.sendMessage(
          m.chat,
          {
            image: buffer,
            caption: txt
          }
        )


      userMessageCount[m.chat].timestamp =
        Date.now()


      console.log(
        `✅ Desafío enviado correctamente: ${randomFlag.name}`
      )


    } catch (error) {

      console.error(
        '❌ Error generando/enviando bandera:',
        error
      )


      userMessageCount[m.chat].currentFlag = null
      userMessageCount[m.chat].currentFlag2 = null
      userMessageCount[m.chat].currentFlag3 = null
      userMessageCount[m.chat].questionMessage = null
      userMessageCount[m.chat].timestamp = null


      return !0
    }
    setTimeout(
      async () => {

        try {

          if (
            userMessageCount[m.chat]
              ?.questionMessage
          ) {

            const messageId =
              userMessageCount[m.chat]
                .questionMessage
                ?.key
                ?.id ||
              userMessageCount[m.chat]
                .questionMessage
                ?.id


            if (messageId) {

              await conn.sendMessage(
                m.chat,
                {
                  delete: {
                    remoteJid: m.chat,
                    id: messageId,
                    fromMe: true
                  }
                }
              )


              console.log(
                `🗑️ Pregunta eliminada: ${messageId}`
              )

            }

          }

        } catch (error) {

          console.error(
            '❌ Error al eliminar el mensaje:',
            error
          )

        }


        if (userMessageCount[m.chat]) {

          userMessageCount[m.chat].currentFlag = null
          userMessageCount[m.chat].currentFlag2 = null
          userMessageCount[m.chat].currentFlag3 = null
          userMessageCount[m.chat].questionMessage = null
          userMessageCount[m.chat].timestamp = null

        }

      },
      180000
    )
  }
  if (
    !userMessageCount[m.chat].timestamp
  ) {
    return !0
  }


  const timeElapsed =
    Date.now() -
    userMessageCount[m.chat].timestamp

  if (timeElapsed > 180000) {
    return !0
  }
  const questionId =
    userMessageCount[m.chat]
      .questionMessage
      ?.key
      ?.id ||
    userMessageCount[m.chat]
      .questionMessage
      ?.id

  if (
    m.quoted &&
    questionId &&
    m.quoted.id === questionId &&
    m.text
      ?.trim()
      .toLowerCase() ===
      userMessageCount[m.chat]
        .currentFlag
        ?.toLowerCase()
  ) {

    await m.react('🎉')


    await conn.reply(
      m.chat,
      `*¡Correcto, ${m.pushName}!* 🎉 La bandera es de *${userMessageCount[m.chat].currentFlag}* ${userMessageCount[m.chat].currentFlag2} y su código es: *${userMessageCount[m.chat].currentFlag3}*.

🏆 *¡Has completado correctamente el desafío!*`,
      m
    )


    try {

      if (questionId) {

        await conn.sendMessage(
          m.chat,
          {
            delete: {
              remoteJid: m.chat,
              id: questionId,
              fromMe: true
            }
          }
        )


        console.log(
          `🗑️ Pregunta eliminada después de respuesta correcta: ${questionId}`
        )

      }

    } catch (error) {

      console.error(
        '❌ Error al eliminar la pregunta:',
        error
      )

    }
    userMessageCount[m.chat].currentFlag = null
    userMessageCount[m.chat].currentFlag2 = null
    userMessageCount[m.chat].currentFlag3 = null
    userMessageCount[m.chat].questionMessage = null
    userMessageCount[m.chat].timestamp = null


    return !0
  }
  else if (
    m.quoted &&
    questionId &&
    m.quoted.id === questionId
  ) {

    const timeRemaining =
      Math.max(
        0,
        180000 - timeElapsed
      )


    const minutesRemaining =
      Math.floor(
        timeRemaining / 60000
      )


    const secondsRemaining =
      Math.floor(
        (timeRemaining % 60000) / 1000
      )


    await m.react('✖️')


    await conn.reply(
      m.chat,
      `*¡Respuesta Incorrecta!*
> vuelve a intentar

🧩 _*Pista:* Su código de área es *${userMessageCount[m.chat].currentFlag3}* ${userMessageCount[m.chat].currentFlag2}_

⏳ *Tiempo restante:* _${minutesRemaining} minutos y ${secondsRemaining} segundos._`,
      m
    )

  }


  return !0
}
