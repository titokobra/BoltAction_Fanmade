/* =============================================================================
   APP.JS · LÓGICA Y PANTALLAS DE LA APLICACIÓN
   =============================================================================
   ÍNDICE RÁPIDO (busca con Ctrl+F el texto entre comillas):
     "ESTADO"            → variables que recuerda la app (nombres, dados, ronda…)
     "PANTALLAS"         → el HTML de cada pantalla (textos de botones y títulos)
     "ACCIONES DEL JUEGO"→ lo que ocurre al sacar dados, acabar ronda, etc.
     "CLICS"             → qué hace cada botón al pulsarlo (data-action="...")
     "NUEVA PARTIDA"     → elección de misión y despliegue (automática o manual) tras CONTINUAR

   CÓMO FUNCIONA, EN BREVE:
     1. state.screen guarda la pantalla actual (p. ej. 'home', 'draw').
     2. render() mira state.screen y llama a la función que dibuja esa pantalla.
     3. Cada botón lleva data-action="algo"; el gestor de CLICS lo recoge,
        cambia el estado y vuelve a llamar a render().

   SI QUIERES CAMBIAR…
     • Un texto de un botón/título → búscalo en "PANTALLAS" (están en mayúsculas).
     • Máximo de dados (18) → busca clamp( y cambia el 18.
     • Dados por defecto (8) → busca initialState y cambia d1:8,d2:8,remaining…
     • Aviso del reloj (105 y 135 min) → función updateGlobalClock.
     • Ronda en la que se pregunta si acabar (6) → confirmCount y finishChoice.
   ============================================================================= */

// ----- ATAJOS Y ESTADO ---------------------------------------------------------
// $('#id') es un atajo para document.querySelector. 'view' es la zona <main id="view">
// de index.html donde se dibuja cada pantalla.
// ----- PDF DE REFERENCIA DE REGLAS ---------------------------------------------
// Ruta del PDF que se abre en Reglas > REFERENCIA REGLAS.
// Para usar otro archivo, cambia este texto (la ruta es relativa a index.html).
// Ejemplos:  'pdf/reglas.pdf'   ·   'documentos/manual.pdf'
const REGLAS_PDF = 'pdf/reglas.pdf';
const $ = s => document.querySelector(s);
const view = $('#view');
// ESTADO: valores con los que empieza una partida nueva.
//   screen=pantalla actual · p1/p2=nombres · d1/d2=dados iniciales (por defecto 8)
//   round=ronda actual · remaining1/2=dados que quedan · bag=bolsa de dados
//   drawn=dados ya sacados · last=último jugador que actuó · winner=resultado final
const initialState = () => ({screen:'home',p1:'',p2:'',d1:12,d2:12,round:1,remaining1:12,remaining2:12,bag:[],drawn:[],deploymentPhase:null,last:null,mode:'',winner:null,active:false,removeDieOpen:false,flankingEnabled:false,flankChoices:{p1:null,p2:null},flankRevealed:{p1:false,p2:false},flankStep:1,flankModal:false,flankSelected:null,flankPendingChoice:null,timerStartedAt:null,timerStoppedAt:null,roundStart1:8,roundStart2:8,countLimitNotice:'',score1:0,score2:0,roundScore1:0,roundScore2:0,scoreApplied:false});
// Recupera la partida guardada en el navegador (localStorage) o crea una nueva.
let state = JSON.parse(localStorage.getItem('ba_state') || 'null') || initialState();
// ----- HISTORIAL DEL NAVEGADOR -------------------------------------------------
// Permite que el botón 'atrás' del móvil/navegador vaya a la pantalla anterior
// de la app en vez de salir de la web.
// Historial de navegación de la aplicación
// Aviso "Ya tienes una partida en curso" (ventana de la pantalla de inicio).
// Es una variable normal y NO va dentro de state, para que no se guarde: si se recarga la web, no reaparece.
let startWarnOpen = false;
let lastRenderedScreen = state.screen;
let appHistoryDepth = 0;

history.replaceState({
  boltAction: true,
  screen: state.screen
}, '');
// ----- COMPATIBILIDAD CON PARTIDAS ANTIGUAS ------------------------------------
// Rellena campos que no existían en versiones anteriores para que no den error.
// Compatibilidad con partidas guardadas en versiones anteriores.
if (state.round == null) state.round = state.turn || 1;
delete state.turn;
// Restaurar exactamente la pantalla y la posición guardadas, también en reglas y escenarios.
if (state.scrollY == null) state.scrollY = 0;
if (state.timerStartedAt === undefined) state.timerStartedAt = null;
if (state.timerStoppedAt === undefined) state.timerStoppedAt = null;
if (state.roundStart1 === undefined) state.roundStart1 = state.d1 || 8;
if (state.roundStart2 === undefined) state.roundStart2 = state.d2 || 8;
if (state.countLimitNotice === undefined) state.countLimitNotice = '';
if (state.matchSetup === undefined) state.matchSetup = {};
if (state.deploymentPhase === undefined) state.deploymentPhase = null;// misión/despliegue elegidos (nuevo)
if (state.score1 === undefined) state.score1 = 0;
if (state.score2 === undefined) state.score2 = 0;
if(state.roundScore1===undefined)state.roundScore1=0;
if(state.roundScore2===undefined)state.roundScore2=0;
if(state.scoreApplied===undefined)state.scoreApplied=false;
// ----- FUNCIONES AUXILIARES ----------------------------------------------------
// save(): guarda el estado en el navegador (para no perder la partida al recargar).
function save(){try{localStorage.setItem('ba_state',JSON.stringify(state))}catch(e){console.warn('No se pudo guardar el estado de la partida',e)}}
// esc(): hace seguros los textos (evita que un nombre con < o > rompa la página).
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
// btn(texto, acción, clase): crea un botón HTML. 'acción' es el data-action que
// luego se gestiona en la sección de CLICS.
function btn(label,fn,cls=''){return `<button class="${cls}" data-action="${fn}">${label}</button>`}
function scoreRow(player, name, score){
  return `
    <div class="score-adjust ${player === 'p2' ? 'score-player-2' : ''}">
      <div class="score-player-name">${esc(name)}</div>
      <div class="score-controls">
        <button data-score="${player}" data-delta="-1">−</button>
        <strong>${score}</strong>
        <button data-score="${player}" data-delta="1">+</button>
      </div>
    </div>
  `;
}
// backButton(): dibuja la barra fija superior con los iconos de VOLVER (flecha)
// e INICIO (casita). Para cambiar los iconos, edita los <path> de los SVG.
// El aspecto (tamaño, color, posición) se cambia en css/tema-militar.css.
function backButton(){return `<nav class="nav-stack" aria-label="Navegación"><button class="nav-button nav-back" data-action="back" aria-label="Volver" title="Volver"><svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button><button class="nav-button nav-home" data-action="go-home" aria-label="Inicio" title="Inicio"><svg class="nav-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.2L12 4l8 7.2M6.5 9.8V20h4v-5.5h3V20h4V9.8"/></svg></button></nav>`}
// ----- RELOJ DE LA PARTIDA -----------------------------------------------------
// formatClock(): convierte milisegundos en formato HH:MM:SS.
function formatClock(ms){
 const total=Math.max(0,Math.floor(ms/1000));
 const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),sec=total%60;
 return [h,m,sec].map(v=>String(v).padStart(2,'0')).join(':');
}
// updateGlobalClock(): actualiza el reloj de la pantalla final.
// Se pone amarillo a los 105 min y rojo parpadeante a los 135 min.
function updateGlobalClock(){
 const box=$('#globalClock'),value=$('#clockValue');
 if(!box||!value)return;

 const endTime = state.timerStoppedAt
  ? Number(state.timerStoppedAt)
  : Date.now();

 const elapsed = state.timerStartedAt
  ? endTime - Number(state.timerStartedAt)
  : 0;

 value.textContent=formatClock(elapsed);

 box.classList.toggle('warning',elapsed>=105*60*1000&&elapsed<135*60*1000);
 box.classList.toggle('danger',elapsed>=135*60*1000);
}
// ----- RENDER: ELIGE QUÉ PANTALLA DIBUJAR --------------------------------------
// Se llama cada vez que cambia algo. Mira state.screen y ejecuta la función
// correspondiente. Si añades una pantalla nueva, añade aquí su línea.
function render(){

  if(state.screen !== lastRenderedScreen){
    history.pushState({
      boltAction: true,
      screen: state.screen
    }, '');

    appHistoryDepth++;
    lastRenderedScreen = state.screen;
  }

  updateGlobalClock();
  save();
  document.body.dataset.screen = state.screen;
  if(state.screen!=='home') startWarnOpen=false;   // el aviso de partida en curso solo vive en el inicio
  if(state.screen==='home') return home();
  if(state.screen==='rules-menu') return rulesMenu();
  if(state.screen==='factions') return factions();
  if(state.screen==='faction-detail') return factionDetail();
  if(state.screen==='rules-list') return rulesList();
  if(state.screen==='rules-detail') return rulesDetail();
  if(state.screen==='rules-pdf') return rulesPdf();   // pantalla del PDF de referencia
  if(state.screen==='deployment-menu') return deploymentMenu();
  if(state.screen==='zones-menu') return zonesMenu();
  if(state.screen==='zone-detail') return zoneDetail();
  if(state.screen==='deployment-detail') return deploymentDetail();
  if(state.screen==='scenario-groups') return groups();
  if(state.screen==='base-scenario-list') return baseScenarioList();
  if(state.screen==='base-scenario-detail') return baseScenarioDetail();
  if(state.screen==='scenario-list') return scenarioList();
  if(state.screen==='scenario-detail') return scenarioDetail();
  if(state.screen==='setup') return setup();

  // Nuevas pantallas del flujo de nueva partida (ver sección "NUEVA PARTIDA" más abajo)
  if(state.screen==='auto-ask') return autoAsk();
  if(state.screen==='auto-mode') return autoMode();
  if(state.screen==='zone-pick') return zonePick();
  if(state.screen==='deploy-pick') return deployPick();
  if(state.screen==='auto-result') return autoResult();
  if(state.screen==='predeploy') return predeploy();   // despliegue inicial (reserva, infiltradores, transportes)
  if(state.screen==='infiltrator-title') return infiltratorTitle();
  if(state.screen==='generating') return generating();
  if(state.screen==='round-title') return roundTitle();
  if(state.screen==='draw') return draw();
  if(state.screen==='round-finished') return roundFinished();
  if(state.screen==='count') return countScreen();
  if(state.screen==='finish-choice') return finishChoice();
  if(state.screen==='winner') return winner();
}
// =============================================================================
// PANTALLAS (cada función dibuja una pantalla dentro de <main id="view">)
// =============================================================================
// PANTALLA DE INICIO: los 5 botones del menú principal.
// 'CONTINUAR PARTIDA' solo aparece si hay una partida en marcha (state.active).
function home(){
 view.innerHTML=`<section class="panel home-panel"><div class="menu-grid">
 <button class="menu-button" data-action="start">COMENZAR PARTIDA</button>
 <button class="menu-button reset-home-button" data-action="reset">REINICIAR PARTIDA</button>
 <button class="menu-button" data-action="scenario-groups">ELECCIÓN DE ESCENARIOS</button>
 <button class="menu-button" data-action="zones-menu">ZONAS DE DESPLIEGUE</button>
 <button class="menu-button" data-action="deployment-menu">TIPO DE DESPLIEGUE</button>
 <button class="menu-button" data-action="rules-menu">REGLAS</button>
 </div>${state.active?`<div class="home-actions">${btn('CONTINUAR PARTIDA','resume')}</div>`:''}</section>${startWarnOpen?startWarnModal():''}`;
}
// LISTA DE FACCIONES (Reglas > Reglas de facciones). Se genera sola a partir de
// factionRules en datos.js: para añadir un ejército, añádelo allí.
function factions(){
 const names=Object.keys(factionRules);
 view.innerHTML=`<section class="panel faction-index"><h2>REGLAS DE FACCIONES</h2><div class="scenario-list">${names.map(name=>`<button data-faction="${esc(name)}">${esc(name)}</button>`).join('')}</div></section>${backButton()}`;
}
// DETALLE DE UNA FACCIÓN: tarjetas con sus reglas especiales (datos.js > factionRules).
function factionDetail(){
 const name=state.factionName, rules=factionRules[name]||[];
 const cards=rules.map(rule=>{
   if(rule.national){
     const opts=rule.options.map(option=>`<article class="faction-card"><div class="faction-card-title"><strong>${esc(option.title)}</strong><em>(solamente se puede elegir una para toda la partida)</em></div><div class="faction-card-text">${esc(option.text)}</div></article>`).join('');
     return `<section class="faction-national"><h3>${esc(rule.title)}</h3><p>${esc(rule.text)}</p></section>${opts}`;
   }
   return `<article class="faction-card"><div class="faction-card-title"><strong>${esc(rule.title)}</strong></div><div class="faction-card-text">${esc(rule.text)}</div></article>`;
 }).join('');
 view.innerHTML=`<section class="panel faction-page"><div class="faction-page-heading"><span>REGLAS DE FACCIONES</span><h2>${esc(name)}</h2><small>REGLAS ESPECIALES DEL EJÉRCITO</small></div><div class="faction-rules">${cards}</div></section>${backButton()}`;
}
// MENÚ DE REGLAS: Facciones / Armas / Unidades / Vehículos.
// Para añadir una categoría nueva: añade aquí el botón y créala en specialRules (datos.js).
function rulesMenu(){view.innerHTML=`<section class="panel"><h2>REGLAS</h2><div class="menu-grid">
 <button class="menu-button rule-menu-button" data-action="factions"><span class="rule-menu-label">REGLAS DE FACCIONES</span></button>
 <button class="menu-button rule-menu-button" data-rule-category="REGLAS DE ARMAS"><span class="rule-menu-label">REGLAS DE ARMAS</span></button>
 <button class="menu-button rule-menu-button" data-rule-category="REGLAS DE UNIDADES"><span class="rule-menu-label">REGLAS DE UNIDADES</span></button>
 <button class="menu-button rule-menu-button" data-rule-category="REGLAS DE VEHÍCULOS"><span class="rule-menu-label">REGLAS DE VEHÍCULOS</span></button>
  <!-- Botón que abre el PDF de referencia (pantalla 'rules-pdf') -->
  <button class="menu-button rule-menu-button" data-action="rules-pdf"><span class="rule-menu-label">REFERENCIA REGLAS</span></button>
 </div></section>${backButton()}`}
// LISTA DE REGLAS de una categoría (ordenadas alfabéticamente). Datos: specialRules.
function rulesList(){const cat=state.ruleCategory;const entries=Object.entries(specialRules[cat]||{}).sort((a,b)=>a[0].localeCompare(b[0],'es'));view.innerHTML=`<section class="panel"><h2>${esc(cat)}</h2><div class="scenario-list">${entries.map(([name])=>`<button data-rule-name="${esc(name)}">${esc(name)}</button>`).join('')}</div></section>${backButton()}`}
// DETALLE DE UNA REGLA: título y texto. Datos: specialRules.
function rulesDetail(){const cat=state.ruleCategory,name=state.ruleName,body=specialRules[cat]?.[name]||'';view.innerHTML=`<section class="panel"><h2>${esc(name)}</h2><div class="scenario-content">${esc(body)}</div></section>${backButton()}`}

// TIPO DE DESPLIEGUE: elección según el resultado de un dado D6 (1-3, 4-5, 6).
// REFERENCIA REGLAS: muestra el PDF (ruta en REGLAS_PDF, arriba del todo).
//  - En ordenador se ve dentro de la propia pantalla (<iframe>).
//  - En móvil/tablet muchos navegadores no muestran PDFs incrustados, por eso
//    hay un botón 'ABRIR PDF' que lo abre en una pestaña nueva (se oculta el marco).
function rulesPdf(){
  view.innerHTML=`<section class="panel pdf-panel"><h2>REFERENCIA REGLAS</h2>
  <a class="pdf-open-button" href="${REGLAS_PDF}" target="_blank" rel="noopener">REFERENCIAS RÁPIDAS</a>
  <iframe class="pdf-frame" src="${REGLAS_PDF}" title="Referencia de reglas"></iframe>
  <p class="pdf-note">Si no se ve el documento, usa el botón de arriba.</p></section>${backButton()}`;
}
function deploymentMenu(){
 view.innerHTML=`<section class="panel"><h2>TIPO DE DESPLIEGUE</h2><p class="deployment-roll-prompt">TIRAR UN DADO D6</p><div class="deployment-options">
 <button class="menu-button" data-deployment="1-3"><strong>1-3: ENCUENTRO COMPROMETIDO</strong></button>
 <button class="menu-button" data-deployment="4-5"><strong>4-5: POSICIONES PREPARADAS</strong></button>
 <button class="menu-button" data-deployment="6"><strong>6: NIEBLA DE GUERRA</strong></button>
 </div></section>${backButton()}`;
}

// ZONAS DE DESPLIEGUE
function zonesMenu(){
 view.innerHTML=`
 <section class="panel">
   <h2>ZONAS DE DESPLIEGUE</h2>

   <p class="deployment-roll-prompt">TIRAR UN DADO D6</p><div class="deployment-options">

   <div class="deployment-options">
     <button class="menu-button" data-zone="bordelargo">
       1-3: BORDES LARGOS
     </button>
     <button class="menu-button" data-zone="cuadrantes">
       4-6: CUADRANTES
     </button>
   </div>
 </section>
 ${backButton()}`;
}

// FOTOGRAFÍAS DE ZONAS DE DESPLIEGUE

function zoneDetail(){
  const zones = {
    bordelargo: {
      title: 'BORDE LARGO',
      image: 'images/bordelargo.png',
      description: '<strong>1-3: BORDES LARGOS</strong><br>Divide la mesa en dos mitades, según el mapa de abajo. Ambos jugadores tiran un dado. El que obtenga mayor puntuación elige una zona de despliegue como propia; el adversario obtiene la contraria.'
    },
    cuadrantes: {
      title: 'CUADRANTES',
      image: 'images/cuadrantes.png',
      description: '<strong>4-6: CUADRANTES</strong><br>Divide la mesa en cuadrantes, según el mapa de abajo. Ambos jugadores tiran un dado. El jugador con mayor puntuación elige un cuadrante como zona de despliegue propia; el adversario, el contrario.'
    }
  };

  const zone = zones[state.zoneImage] || zones.bordelargo;

  view.innerHTML = `
    <section class="panel">
      <h2>${zone.title}</h2>
      <div class="deployment-zone-container">
        <img src="${zone.image}" alt="${zone.title}" class="deployment-zone-image">
      </div>

      <p class="deployment-zone-description">${zone.description}</p>
    </section>
    ${backButton()}
  `;
}


// DETALLE DEL DESPLIEGUE: los textos están en datos.js > deploymentRules.
function deploymentDetail(){
 const key=state.deploymentType;
 const titles={'1-3':'1-3: ENCUENTRO COMPROMETIDO','4-5':'4-5: POSICIONES PREPARADAS','6':'6: NIEBLA DE GUERRA'};
 view.innerHTML=`<section class="panel"><article class="deployment-rule-card"><h2>${titles[key]||'TIPO DE DESPLIEGUE'}</h2><div class="scenario-content">${esc(deploymentRules[key]||'')}</div></article></section>${backButton()}`;
}

// ELECCIÓN DE ESCENARIOS: lista de grupos (juego base y otros). Datos: scenarioGroups.
function groups(){view.innerHTML=`<section class="panel"><h2>ELECCIÓN DE ESCENARIOS</h2><div class="menu-grid">${Object.keys(scenarioGroups).map(g=>`<button class="menu-button" data-group="${esc(g)}">${g}</button>`).join('')}</div></section>${backButton()}`}

// LISTA DE ESCENARIOS DEL JUEGO BASE (se elige con un D6).
function baseScenarioList(){view.innerHTML=`<section class="panel"><h2>ESCENARIOS JUEGO BASE</h2><p class="deployment-roll-prompt">TIRAR UN DADO D6</p><div class="scenario-list">${baseScenarioNames.map((name,i)=>`<button data-base-scenario="${i+1}">${i+1}. ${name}</button>`).join('')}</div></section>${backButton()}`}
// DETALLE DE UN ESCENARIO DEL JUEGO BASE. Nombres y textos en datos.js
// (baseScenarioNames y baseScenarioTexts).
function baseScenarioDetail(){
 const n = Number(state.baseScenario);
 const name = baseScenarioNames[n-1] || 'ESCENARIO';
 const text = baseScenarioTexts[n-1] || 'Texto pendiente de incorporar.';

 view.innerHTML = `
 <section class="panel">
   <article class="deployment-rule-card">
     <h2>${n}. ${esc(name)}</h2>
     <div class="scenario-content">${esc(text)}</div>
   </article>
 </section>
 ${backButton()}`;
}
// LISTA DE ESCENARIOS de un grupo (no base).
function scenarioList(){let g=state.group;view.innerHTML=`<section class="panel"><h2>${esc(g)}</h2><div class="scenario-list">${scenarioGroups[g].map(s=>`<button data-scenario="${s[0]}">${s[0].padStart(2,'0')}. ${esc(s[1])}</button>`).join('')}</div></section>${backButton()}`}
// DETALLE DE UN ESCENARIO (no base).
function scenarioDetail(){let s=scenarioGroups[state.group].find(x=>x[0]===state.scenario);view.innerHTML=`<section class="panel"><h2>${esc(s[0])}. ${esc(s[1])}</h2><div class="scenario-content">${esc(s[2])}</div></section>${backButton()}`}
// CONFIGURAR PARTIDA: nombres de jugadores y dados iniciales (botones − y +).
// Los textos "Nombre del jugador 1", etc. se cambian aquí dentro.
function setup(){
 const name1=state.p1==='Jugador 1'?'':state.p1;
 const name2=state.p2==='Jugador 2'?'':state.p2;

 view.innerHTML=`
 <section class="panel setup-panel">
   <h2>CONFIGURAR PARTIDA</h2>

   <div class="field">
     <label>Nombre del jugador 1</label>
     <input
       class="setup-name-input"
       id="p1"
       type="text"
       placeholder="Escribe tu nombre"
       value="${esc(name1)}"
     >
   </div>

   <div class="field">
     <label>Nombre del jugador 2</label>
     <input
       class="setup-name-input"
       id="p2"
       type="text"
       placeholder="Escribe tu nombre"
       value="${esc(name2)}"
     >
   </div>

   <div class="field dice-setup-field">
     <label>Dados iniciales de jugador 1</label>
     <div class="initial-dice-control">
       <button type="button" data-dice-adjust="d1" data-delta="-1">−</button>
       <strong>${state.d1}</strong>
       <button type="button" data-dice-adjust="d1" data-delta="1">+</button>
     </div>
   </div>

   <div class="field dice-setup-field">
     <label>Dados iniciales de jugador 2</label>
     <div class="initial-dice-control">
       <button type="button" data-dice-adjust="d2" data-delta="-1">−</button>
       <strong>${state.d2}</strong>
       <button type="button" data-dice-adjust="d2" data-delta="1">+</button>
     </div>
   </div>

   <div class="choice-row">
     ${btn('CONTINUAR','begin')}
   </div>
 </section>
 ${backButton()}`;
}
// ----- REGLAS DE FLANQUEO (pantallas opcionales de elección de flanco) --------
// flankingAsk: pregunta si se usarán. flankingChoose: cada jugador elige izquierda/derecha.
// flankingRevealModal: ventana para revelar el flanco elegido.
function flankingAsk(){view.innerHTML=`<section class="panel"><h2>REGLAS DE FLANQUEO</h2><p>¿Se utilizarán las reglas de flanqueo en esta partida?</p><div class="choice-row">${btn('SÍ, UTILIZAR FLANQUEO','flanking-yes')}${btn('NO, SIN FLANQUEO','flanking-no')}</div></section>${backButton()}`}
function flankingChoose(){const who=state.flankStep===1?'p1':'p2',name=who==='p1'?state.p1:state.p2,chosenText=state.flankPendingChoice?`<div class="flank-choice-confirmation">${esc(name)} eligió el flanqueo por la ${state.flankPendingChoice==='left'?'izquierda':'derecha'}.</div>`:'';view.innerHTML=`<section class="panel"><h2>ELECCIÓN DE FLANQUEO</h2><p><strong>${esc(name)}</strong></p><p>¿Por qué lado quieres realizar el flanqueo?</p><div class="flank-choice-grid"><button class="flank-choice ${state.flankPendingChoice==='left'?'selected':''}" data-action="choose-left"><span class="flank-arrow">←</span><span>Por tu izquierda</span></button><button class="flank-choice ${state.flankPendingChoice==='right'?'selected':''}" data-action="choose-right"><span class="flank-arrow">→</span><span>Por tu derecha</span></button></div>${chosenText}<div class="notice">Tu elección será privada y no se mostrará al otro jugador.</div><div class="choice-row">${btn('SIGUIENTE','confirm-flank-choice',state.flankPendingChoice?'':'')} </div></section>`}
function flankingRevealModal(){if(!state.flankModal)return '';if(!state.flankSelected)return `<div class="remove-modal" role="dialog" aria-modal="true"><div class="remove-modal-card"><h2>¿Qué jugador quiere revelar su flanqueo?</h2><div class="remove-modal-choices">${!state.flankRevealed.p1?btn(esc(state.p1),'select-flank-p1'):''}${!state.flankRevealed.p2?btn(esc(state.p2),'select-flank-p2'):''}${btn('CANCELAR','cancel-flank')}</div></div></div>`;const name=state.flankSelected==='p1'?state.p1:state.p2;return `<div class="remove-modal" role="dialog" aria-modal="true"><div class="remove-modal-card"><h2>CONFIRMAR REVELACIÓN</h2><p>¿Estás seguro de que quieres revelar el flanqueo de ${esc(name)}?</p><p class="muted">La elección solo se mostrará si pulsas CONFIRMAR.</p><div class="remove-modal-choices">${btn('CONFIRMAR','confirm-flank-reveal')}${btn('CANCELAR','cancel-flank')}</div></div></div>`}
// ----- NUEVA PARTIDA: PANTALLAS DE ELECCIÓN DE MISIÓN Y DESPLIEGUE -----------------
// 1) ¿Elegimos la partida automáticamente? SÍ → autoMode · NO → zonePick
// Para cambiar el mensaje, edita el texto del <h2>.
function autoAsk(){
  view.innerHTML=`<section class="panel flow-panel"><h2>¿Que decidan los dados?</h2>
  <p class="flow-intro">Sorteamos misión y despliegue al azar, o los eliges tú antes de desplegar las tropas.</p>
  <div class="choice-row">${btn('SORTEAR','auto-yes')}${btn('ELEGIR A MANO','auto-no')}</div></section>${backButton()}`;
}
// 2) Si dijo SÍ: de dónde sacar la misión. Los textos de los botones se cambian aquí.
function autoMode(){
  view.innerHTML=`<section class="panel"><h2>Partida automática</h2>
  <div class="flow-options">
   <button class="menu-button" data-action="auto-base">MISIONES JUEGO BASE</button>
   <button class="menu-button" data-action="auto-pack">MISIONES 26 27</button>
   <button class="menu-button" data-action="auto-both">AMBAS</button>
   <button class="menu-button" data-action="auto-manual">MANUALMENTE</button>
  </div></section>${backButton()}`;
}
// 3) Elección manual, paso 1: zona de despliegue (se guarda en state.matchSetup.zone)
function zonePick(){
  view.innerHTML=`<section class="panel"><h2>Selecciona zona de despliegue</h2>
  <div class="flow-options">
   <button class="menu-button" data-action="pick-zone" data-zone="1-3">${ZONE_LABELS['1-3']}</button>
   <button class="menu-button" data-action="pick-zone" data-zone="4-6">${ZONE_LABELS['4-6']}</button>
  </div></section>${backButton()}`;
}
// 4) Elección manual, paso 2: tipo de despliegue + nota pequeña debajo.
// Al elegir uno se abre el resumen (autoResult) con lo elegido y el botón COMENZAR PARTIDA.
function deployPick(){
  view.innerHTML=`<section class="panel"><h2>¿Qué tipo de despliegue quieres seleccionar?</h2>
  <div class="flow-options">
   <button class="menu-button" data-action="pick-deploy" data-deploy="1-3">${DEPLOY_LABELS['1-3']}</button>
   <button class="menu-button" data-action="pick-deploy" data-deploy="4-5">${DEPLOY_LABELS['4-5']}</button>
   <button class="menu-button" data-action="pick-deploy" data-deploy="6">${DEPLOY_LABELS['6']}</button>
  </div>
  <p class="flow-note">Puedes consultar estas reglas en el menú principal seleccionando Tipo de despliegue.</p></section>${backButton()}`;
}
// 5) Resultado / resumen: misión sorteada (+ zona y tipo si es del juego base) o, en elección manual,
//    la zona y el tipo elegidos. Siempre con el botón COMENZAR PARTIDA.
function autoResult(){
  const m=state.matchSetup||{};
  // Elección MANUAL: no hay misión, solo la zona y el tipo que se han elegido (sin dado)
  const manual=!m.src&&m.zone&&m.deploy;
  if(!m.src&&!manual){state.screen='auto-mode';return render()}   // por seguridad si no hay nada guardado
  let title='',text='',label='';
  if(m.src==='base'){title=`${m.n}. ${baseScenarioNames[m.n-1]}`;text=baseScenarioTexts[m.n-1]||'';label='MISIÓN DEL JUEGO BASE'}
  else if(m.src==='pack'){const sc=scenarioGroups[PACK_GROUP].find(x=>String(x[0])===String(m.n));title=`${sc[0]}. ${sc[1]}`;text=sc[2];label='MISIÓN PACK 26 27'}
  // Línea "Dado: N" solo cuando el valor salió de un sorteo (en manual no se muestra)
  const dado=r=>r?`<small>Dado: ${r}</small>`:'';
  // Recuadros de zona y tipo: en juego base (sorteados) y en manual (elegidos).
  // En misiones del pack no salen, porque ya traen su despliegue en el texto.
  const chips=(m.zone&&m.deploy)?`<div class="result-chips">
    <div class="result-chip"><span>ZONA DE DESPLIEGUE</span><strong>${ZONE_LABELS[m.zone]}</strong>${dado(m.zoneRoll)}</div>
    <div class="result-chip"><span>TIPO DE DESPLIEGUE</span><strong>${DEPLOY_LABELS[m.deploy]}</strong>${dado(m.deployRoll)}</div>
  </div>`:'';
  // Cabecera con el nombre de la misión (no existe en manual) y texto completo de la misión
  const head=manual?'':`<div class="result-mission"><span class="result-label">${label}</span><h3>${esc(title)}</h3></div>`;
  const body=manual?'':`<div class="scenario-content">${esc(text)}</div>`;
  view.innerHTML=`<section class="panel"><h2>${manual?'Resumen de la partida':'Partida automática'}</h2>
  ${head}
  ${chips}
  ${body}
  <div class="choice-row">${btn('COMENZAR PARTIDA','launch')}</div></section>${backButton()}`;
}
// PANTALLA 'GENERANDO DADOS ALEATORIOS' (transición corta).
function generating(){view.innerHTML=`<section class="panel" style="text-align:center;padding:60px 20px"><h2>GENERANDO DADOS ALEATORIOS</h2><p class="muted">Preparando la bolsa de dados…</p></section>`;setTimeout(()=>{if(state.screen==='generating'){state.screen='round-title';render()}},900)}
// TÍTULO DE RONDA: muestra 'RONDA N' y el botón COMENZAR RONDA.
function roundTitle(){view.innerHTML=`<section class="panel"><div class="turn-title">RONDA ${state.round}</div><div style="text-align:center">${btn('COMENZAR RONDA','start-round')}</div></section>${backButton()}`}
// Pantalla entre la primera oleada y la ronda 1.
function infiltratorTitle(){view.innerHTML=`<section class="panel flow-panel"><div class="turn-title infiltrator-title">COLOCACIÓN DE INFILTRADORES</div><p class="flow-intro">La primera oleada ha terminado. Coloca ahora los infiltradores antes de comenzar la partida.</p><div class="choice-row infiltrator-actions">${btn('SIGUIENTE','start-round-1')}</div></section>${backButton()}`}
// EXTRACCIÓN DE DADOS: contadores de cada jugador, cuadro grande con el jugador que
// actúa, botón SIGUIENTE DADO / FIN DE RONDA y ventana de ELIMINAR DADO.
// El color de fondo del cuadro cambia según quién toque (variables --green y --red).
function draw(){
 // Estos contadores reflejan los dados que quedan realmente dentro de la bolsa de esta ronda.
 const n1=state.bag.filter(x=>x==='p1').length,n2=state.bag.filter(x=>x==='p2').length;
view.innerHTML=`<section class="panel">${state.deploymentPhase==='first-wave'?'<div class="turn-title first-wave-title">PRIMERA OLEADA</div>':''}<div class="dice-counters"><div class="counter">${esc(state.p1)}<strong>${n1}</strong><small class="muted">dados en la bolsa</small><div class="counter-score">Puntuación: <strong>${state.score1}</strong></div></div>
<div class="counter player-2-counter">${esc(state.p2)}<strong>${n2}</strong><small class="muted">dados en la bolsa</small><div class="counter-score">Puntuación: <strong>${state.score2}</strong></div></div></div>
 <div class="draw-area" id="drawArea" style="background:${state.last==='p1'?'var(--green)':state.last==='p2'?'var(--red)':'#272a22'}"><div class="player-name">${state.last?esc(state.last==='p1'?state.p1:state.p2):'¿QUIÉN ACTÚA?'}</div><div class="curtain ${state.reveal?'lift':''}" id="curtain"></div></div>
 <div class="extracted-summary" aria-live="polite">${state.resumeNotice&&state.last?`<div class="resume-notice ${state.last==='p1'?'player-1':'player-2'}"><span>LE TOCABA A</span><strong>${state.last==='p1'?'JUGADOR 1':'JUGADOR 2'}</strong></div>`:''}${state.drawn.length===0?'<strong>Todavía no se ha extraído ningún dado</strong>':`<strong class="extracted-count">Dados extraídos: ${state.drawn.length}</strong><span class="extracted-note">${state.deploymentPhase==='first-wave'?'Al agotarse la bolsa, termina la oleada.':'Al agotarse la bolsa, termina la ronda.'}</span>`}</div>
 <div class="draw-actions">${state.bag.length?btn('SIGUIENTE DADO','next-die'):btn('FIN DE RONDA','end-round')}</div>
 <div class="dice-remove-action">${state.bag.length?btn('ELIMINAR DADO','open-remove-die'):''}</div>
</section>
 ${state.removeDieOpen?`<div class="remove-modal" role="dialog" aria-modal="true" aria-labelledby="removeDieTitle"><div class="remove-modal-card"><h2 id="removeDieTitle">¿A qué jugador quieres eliminar un dado?</h2><div class="remove-modal-choices">${btn(esc(state.p1),'remove-p1','') .replace('<button ','<button '+(state.bag.includes('p1')?'':'disabled '))}${btn(esc(state.p2),'remove-p2','').replace('<button ','<button '+(state.bag.includes('p2')?'':'disabled '))}${btn('CANCELAR','cancel-remove-die','cancel-remove')}</div><p class="remove-help">El dado se resta inmediatamente de la bolsa de esta ronda y del contador visible. No modifica el recuento que se utilizará para preparar la siguiente ronda.</p></div></div>`:''}${flankingRevealModal()}${backButton()}`;
}
// DADOS PARA LA SIGUIENTE RONDA: cada jugador indica cuántos dados le quedan.
function countScreen(){view.innerHTML=`<section class="panel"><h2>DADOS PARA LA SIGUIENTE RONDA</h2><p class="count-instruction">Hecho el recuento de bajas, indica cuántos dados de orden conserva cada jugador para la próxima ronda. Las bajas no se recuperan: no puedes superar los dados con los que empezaste esta ronda.</p>
 ${adjustRow('p1',state.p1,state.remaining1)}<small class="muted">Máximo de ${esc(state.p1)}: ${state.roundStart1}</small>${adjustRow('p2',state.p2,state.remaining2)}<small class="muted">Máximo de ${esc(state.p2)}: ${state.roundStart2}</small>${state.countLimitNotice?`<p class="notice" role="alert">${esc(state.countLimitNotice)}</p>`:''}
 <div class="choice-row">${btn('CONFIRMAR Y CONTINUAR','confirm-count')}</div></section>${backButton()}`}
// adjustRow(): una fila con nombre del jugador y botones − / + (se usa en countScreen).
function adjustRow(id,name,val){return `<div class="player-adjust"><button data-adjust="${id}" data-delta="-1" aria-label="Restar">−</button><div><div class="pname">${esc(name)}</div><div class="count">${val}</div></div><button data-adjust="${id}" data-delta="1" aria-label="Sumar">+</button></div>`}
// FINAL DE LA RONDA 6: ya hecho el recuento de puntos, pregunta si hay turno 7.
//   FIN DE PARTIDA   -> pantalla final (no se cuentan dados porque no hay más rondas)
//   JUGAR TURNO 7    -> pantalla de dados para la siguiente ronda y después RONDA 7
function finishChoice(){view.innerHTML=`<section class="panel flow-panel"><h2>FINAL DE LA RONDA 6</h2><p class="flow-intro">Recuento hecho. ¿Se da por terminada la batalla o se juega un turno 7?</p><div class="choice-row">${btn('FIN DE PARTIDA','end-match')}${btn('JUGAR TURNO 7','round-seven')}</div></section>${backButton()}`}
// PARTIDA FINALIZADA: duración total, selección del resultado (J1 / J2 / EMPATE)
// y botón VOLVER.
function winner(){
 const result=state.score1>state.score2?state.p1:state.score2>state.score1?state.p2:'EMPATE';
 state.winner=result;

 view.innerHTML=`
 <section class="panel winner-panel" style="text-align:center">
  <h2>PARTIDA FINALIZADA</h2>

  <div id="globalClock" aria-live="off" style="position:static;display:flex;flex-direction:column;align-items:center;margin:20px auto;width:max-content;max-width:100%;">
   <span class="clock-label">DURACIÓN TOTAL DE LA PARTIDA</span>
   <span class="clock-value" id="clockValue">00:00:00</span>
  </div>

  <h3 class="winner-announcement">
   ${result==='EMPATE'?'¡PARTIDA EMPATADA!':`¡ENHORABUENA, ${esc(result)}!`}
  </h3>

  <div class="winner-scores">
   <div><span>${esc(state.p1)}</span><strong>${state.score1}</strong></div>
   <div><span>${esc(state.p2)}</span><strong>${state.score2}</strong></div>
  </div>

  <div class="choice-row" style="justify-content:center">
   ${btn('VOLVER','home-finished')}
  </div>
 </section>`;

 updateGlobalClock();
}
// RONDA FINALIZADA: pantalla intermedia al agotarse la bolsa.
// RONDA FINALIZADA: muestra el resultado de la ronda y permite actualizar puntos.
function roundFinished(){
 view.innerHTML=`
 <section class="panel">
  <div class="round-finish-area">
   <div class="round-finish-title">Recuento de puntos de Victoria de la Ronda ${state.round}</div>
   <div class="curtain" id="finishCurtain"></div>
  </div>
  <h2 class="score-heading">PUNTUACIÓN DE CADA JUGADOR</h2>
  <div class="score-board">
   ${scoreRow('p1',state.p1,state.roundScore1)}
   ${scoreRow('p2',state.p2,state.roundScore2)}
  </div>
  <div class="draw-actions score-continue">
   ${btn('CONTINUAR','continue-round')}
  </div>
 </section>${backButton()}`;   // backButton(): iconos de volver e inicio, como en el resto de la web
 requestAnimationFrame(()=>{
  const c=$('#finishCurtain');
  if(c)c.classList.add('lift')
 });
}
// =============================================================================
// ACCIONES DEL JUEGO (la lógica: no dibujan pantallas, cambian el estado)
// =============================================================================
// newBag(): llena la bolsa con tantos dados de cada jugador como le queden y la mezcla.
// ----- AVISO "YA TIENES UNA PARTIDA EN CURSO" ---------------------------------------
// hasGameInProgress(): ¿hay una partida real empezada y sin terminar?
//   - state.active        → se empezó una partida
//   - state.launched      → ya se pulsó COMENZAR PARTIDA (false mientras se está eligiendo misión/despliegue)
//   - timerStartedAt      → el reloj está en marcha
//   - !timerStoppedAt     → todavía no se ha terminado (en la pantalla final el reloj se para)
// Si quieres que el aviso salga en más situaciones, cambia las condiciones de aquí.
function hasGameInProgress(){
  return !!(state.active && state.launched!==false && state.timerStartedAt && !state.timerStoppedAt);
}
// startWarnModal(): ventana emergente con el aviso. Para cambiar el mensaje, edita el texto del <p>.
//   SÍ  → continúa y abre CONFIGURAR PARTIDA (la partida anterior se pierde al pulsar CONTINUAR allí)
//   NO  → cierra la ventana y no pasa nada (se mantiene la partida en curso)
function startWarnModal(){
  return `<div class="remove-modal" role="dialog" aria-modal="true" aria-labelledby="startWarnTitle"><div class="remove-modal-card">
  <h2 id="startWarnTitle">PARTIDA EN CURSO</h2>
  <p class="start-warn-text">Ya tienes una partida en curso. Si pulsas en comenzar partida de nuevo, perderás la partida anterior. ¿Quieres continuar?</p>
  <div class="remove-modal-choices start-warn-choices">${btn('SÍ','start-confirm')}${btn('NO','start-cancel','cancel-remove')}</div>
  </div></div>`;
}

// =============================================================================
// NUEVA PARTIDA · ELECCIÓN DE MISIÓN Y DESPLIEGUE (automática o manual)
// =============================================================================
// FLUJO (empieza al pulsar CONTINUAR en CONFIGURAR PARTIDA):
//   auto-ask   → "¿Quieres que elijamos la partida automáticamente?"  SÍ / NO
//     NO  → zone-pick (zona de despliegue) → deploy-pick (tipo de despliegue) → auto-result (resumen) → RONDA 1
//     SÍ  → auto-mode: MISIONES JUEGO BASE / MISIONES 26 27 / AMBAS / MANUALMENTE
//             BASE  → misión al azar de las 6 + zona y tipo al azar → auto-result
//             26 27 → misión al azar de las 25 (ya traen su despliegue)  → auto-result
//             AMBAS → una al azar entre las 31 (6 base + 25 del pack)    → auto-result
//             MANUALMENTE → igual que NO (zone-pick → deploy-pick)
//   auto-result → COMENZAR PARTIDA → predeploy → CONTINUAR → PRIMERA OLEADA → COLOCACIÓN DE INFILTRADORES → RONDA 1
//   La primera oleada usa solo sus dados; la ronda 1 vuelve a cargar todos los dados originales.
// El resultado se guarda en state.matchSetup = {src,n,zone,zoneRoll,deploy,deployRoll}
//   src='base' (juego base) o 'pack' (26 27) · n=número de misión · zone/deploy=claves de abajo.

// Nombre EXACTO del grupo de misiones 26 27 en datos.js > scenarioGroups.
// Si algún día lo renombras allí, cámbialo aquí también.
const PACK_GROUP = 'PACK MISIONES 26 27';

// Textos de las zonas de despliegue (clave = rango del dado D6). Cambia aquí los nombres.
const ZONE_LABELS = {'1-3':'1-3: BORDE LARGO','4-6':'4-6: CUADRANTES'};
// Textos de los tipos de despliegue. Deben coincidir con las claves de deploymentRules (datos.js).
const DEPLOY_LABELS = {'1-3':'1-3: ENCUENTRO COMPROMETIDO','4-5':'4-5: POSICIONES PREPARADAS','6':'6: NIEBLA DE GUERRA'};

// ----- DESPLIEGUE INICIAL (PREPARTIDA): QUÉ REGLA SE APLICA A CADA MISIÓN ------------
// PACK_DESPLIEGUE: cómo se conoce el tipo de despliegue de cada misión del pack 26 27.
//   - Misiones 1 a 6 (no aparecen aquí): son copias de las del juego base y dicen "tirar en tabla",
//     así que se sortean zona y tipo de despliegue.
//   - special:true  → misiones 7, 8 y 12: el atacante y el defensor despliegan de forma distinta.
//                     Los contadores quedan libres y sale un aviso para revisar el texto.
//   - type:'1-3'    → Encuentro comprometido · type:'4-5' → Posiciones preparadas (ya escrito en la misión)
//   - note:true     → además sale un aviso de que la misión tiene reglas propias de despliegue.
const PACK_DESPLIEGUE = {
  '7':{special:true},'8':{special:true},'12':{special:true},
  '9':{type:'4-5'},'10':{type:'4-5'},'11':{type:'4-5'},'13':{type:'1-3',note:true},'14':{type:'4-5'},
  '15':{type:'4-5'},'16':{type:'4-5'},'17':{type:'1-3'},'18':{type:'1-3'},'19':{type:'4-5'},'20':{type:'4-5'},
  '21':{type:'1-3'},'22':{type:'1-3'},'23':{type:'1-3'},'24':{type:'4-5'},'25':{type:'4-5'}
};
// noReserveMission(m): RUPTURA (misión 3 del juego base y del pack): NO se permiten reservas.
// Por eso, si al sortear sale Niebla de guerra (que obliga a tener reservas) se repite la tirada.
function noReserveMission(m){return m.n!=null&&String(m.n)==='3'&&(m.src==='base'||m.src==='pack')}
// noInfiltMission(m): ROMPIENDO LA LÍNEA (misión 18 del pack): no hay infiltrados en la mesa al empezar.
function noInfiltMission(m){return m.src==='pack'&&String(m.n)==='18'}

// d6(): simula un dado de 6 caras (1-6).
function d6(){return 1+Math.floor(Math.random()*6)}
// rollDeployment(m): tira un D6 para la zona (1-3 borde largo, 4-6 cuadrantes) y otro D6 para el
// tipo (1-3 encuentro comprometido, 4-5 posiciones preparadas, 6 niebla de guerra).
function rollDeployment(m){
  m.zoneRoll=d6();m.zone=m.zoneRoll<=3?'1-3':'4-6';
  const tipo=r=>r<=3?'1-3':(r<=5?'4-5':'6');
  // En Ruptura no se admiten reservas: si sale Niebla de guerra (6) se repite la tirada del tipo
  do{m.deployRoll=d6();m.deploy=tipo(m.deployRoll)}while(m.deploy==='6'&&noReserveMission(m));
  return m;
}
// rollBase(n): misión del juego base (al azar, o la número n si se indica) + zona y tipo al azar.
function rollBase(n){
  const total=baseScenarioNames.length;
  return rollDeployment({src:'base',n:n||1+Math.floor(Math.random()*total)});
}
// rollPack(i): misión del pack 26 27 (al azar, o la posición i de la lista si se indica).
// Estas misiones ya llevan su despliegue definido en su texto, así que no se tira nada más.
function rollPack(i){
  const list=scenarioGroups[PACK_GROUP];
  const sc=list[i==null?Math.floor(Math.random()*list.length):i];
  const m={src:'pack',n:sc[0]};
  const cfg=PACK_DESPLIEGUE[String(sc[0])];
  if(!cfg)return rollDeployment(m);                 // misiones 1-6: "tirar en tabla" (zona y tipo al azar)
  if(cfg.special){m.special=true;m.note=true}       // misiones 7, 8, 12: reglas propias atacante/defensor
  else{m.deploy=cfg.type;if(cfg.note)m.note=true}   // el resto: tipo fijo escrito en la misión
  return m;
}
// rollBoth(): todas las misiones en un mismo saco (6 base + 25 del pack), cada una con la misma
// probabilidad. Si sale una del juego base, se le tiran también zona y tipo de despliegue.
function rollBoth(){
  const nb=baseScenarioNames.length,np=scenarioGroups[PACK_GROUP].length;
  const k=Math.floor(Math.random()*(nb+np));
  return k<nb?rollBase(k+1):rollPack(k-nb);
}
// launchMatch(): se pulsa COMENZAR PARTIDA (o se termina la elección manual). Arranca el reloj
// de la partida y pasa a 'GENERANDO DADOS' → RONDA 1.
// launchMatch(): se pulsa COMENZAR PARTIDA. Si se conoce el tipo de despliegue (o la misión tiene
// reglas propias) se abre primero la pantalla de DESPLIEGUE INICIAL; si no, se empieza directamente.
function launchMatch(){
  const m=state.matchSetup||{};
  if(m.deploy||m.special){
    state.preGame={p1:{res:0,inf:0,trn:0},p2:{res:0,inf:0,trn:0}};   // todos los contadores empiezan en 0
    state.screen='predeploy';render();
  }else startRound1();
}
// startFirstWave(): prepara una bolsa exclusiva con los dados calculados como primera oleada.
// No incluye reservas, infiltradores ni dados en transportes. Tampoco consume los dados originales.
function startFirstWave(){
  state.deploymentPhase='first-wave';
  state.bag=[];
  for(let i=0;i<preWave('p1');i++)state.bag.push('p1');
  for(let i=0;i<preWave('p2');i++)state.bag.push('p2');
  state.bag.sort(()=>Math.random()-.5);
  state.drawn=[];state.last=null;state.reveal=false;state.removeDieOpen=false;state.resumeNotice=false;
  state.screen='draw';save();render();
}
// startRound1(): tras colocar infiltradores, comienza la ronda 1 con TODOS los dados originales.
function startRound1(){
  state.timerStartedAt=Date.now();state.timerStoppedAt=null;
  state.launched=true;
  state.deploymentPhase=null;
  state.remaining1=state.d1;state.remaining2=state.d2;
  state.roundStart1=state.d1;state.roundStart2=state.d2;
  state.round=1;
  state.screen='generating';save();render();
}

// ----- PANTALLA DE DESPLIEGUE INICIAL (PREPARTIDA) -------------------------------------
// Un recuadro por jugador con: dados totales, En Reserva, Infiltradores, En Transportes y, calculada
// sola, la Primera oleada (= total − reserva − infiltradores − transportes). Contadores desde 0.
//   · Encuentro comprometido (1-3) y Posiciones preparadas (4-5): reserva máx. = mitad redondeada hacia ABAJO.
//   · Niebla de guerra (6): reserva obligatoria, mín. = mitad redondeada hacia ARRIBA.
//   · Ruptura: sin reservas · Rompiendo la línea: sin infiltradores · misiones 7, 8, 12: contadores libres.
// preRules(m,total): límites [mín,máx] de cada contador según el tipo de despliegue y la misión.
function preRules(m,total){
  let res,inf=[0,total],trn=[0,total];
  if(m.special)res=[0,total];
  else if(m.deploy==='6')res=[Math.ceil(total/2),total];
  else res=[0,Math.floor(total/2)];
  if(noReserveMission(m))res=[0,0];
  if(noInfiltMission(m))inf=[0,0];
  return {res,inf,trn};
}
// preTotal(p): dados con los que empieza la partida cada jugador.
function preTotal(p){return p==='p1'?state.remaining1:state.remaining2}
// preWave(p): primera oleada de un jugador.
function preWave(p){const o=state.preGame[p];return preTotal(p)-o.res-o.inf-o.trn}
// preValid(): ¿se cumplen las reglas obligatorias? (en Niebla de guerra, la reserva mínima)
function preValid(){
  const m=state.matchSetup||{};
  return ['p1','p2'].every(p=>state.preGame[p].res>=preRules(m,preTotal(p)).res[0]&&preWave(p)>=0);
}
// preAdjust(p,k,d): suma (+1) o resta (−1) en el contador k ('res','inf','trn') del jugador p.
function preAdjust(p,k,d){
  const m=state.matchSetup||{},o=state.preGame[p],t=preTotal(p),cap=preRules(m,t)[k];
  const v=o[k]+d;
  if(v<0||v>cap[1]||preWave(p)-d<0)return;          // no baja de 0, no pasa del máximo, la oleada no es negativa
  o[k]=v;save();
  const y=window.scrollY;render();window.scrollTo(0,y);
}
function predeploy(){
  const m=state.matchSetup||{};
  if(!state.preGame)state.preGame={p1:{res:0,inf:0,trn:0},p2:{res:0,inf:0,trn:0}};
  const t6=m.deploy==='6';
  const tipo=m.special?'Reglas propias de la misión':DEPLOY_LABELS[m.deploy];
  const regla=m.special?'':(t6?'Al menos la mitad de las unidades, redondeando hacia arriba, debe quedar en reserva.'
                            :'Hasta la mitad de las unidades, redondeando hacia abajo, puede quedar en reserva.');
  const extra=[];
  if(m.note)extra.push('Esta misión tiene reglas propias de despliegue (atacante y defensor): revisa el texto de la misión.');
  if(noReserveMission(m))extra.push('En esta misión no se permiten unidades en reserva.');
  if(noInfiltMission(m))extra.push('En esta misión no hay infiltrados sobre la mesa al empezar.');
  const fila=(p,k,label,tag,disabled)=>{
    const o=state.preGame[p],t=preTotal(p),cap=preRules(m,t)[k],sum=o.res+o.inf+o.trn;
    const menos=o[k]<=0,mas=o[k]>=cap[1]||sum>=t;
    return `<div class="pre-row"><span class="pre-label">${label}${tag?`<small>${tag}</small>`:''}</span>
      <div class="pre-counter"><button class="pre-btn" data-action="pre-adj" data-p="${p}" data-k="${k}" data-d="-1" aria-label="Quitar ${label}" ${menos?'disabled':''}>−</button><strong>${o[k]}</strong><button class="pre-btn" data-action="pre-adj" data-p="${p}" data-k="${k}" data-d="1" aria-label="Añadir ${label}" ${mas?'disabled':''}>+</button></div></div>`;
  };
  const caja=(p,num)=>{
    const t=preTotal(p),r=preRules(m,t),escrito=((num===1?state.p1:state.p2)||'').trim();
    // Si el jugador no escribió su nombre (o es el de por defecto) solo se pone "Jugador N"
    const titulo=escrito&&escrito.toLowerCase()!==('jugador '+num)?`Jugador ${num} · ${esc(escrito)}`:`Jugador ${num}`;
    const tagRes=m.special?'':(noReserveMission(m)?'(no permitida)':(t6?`(Mín ${r.res[0]})`:`(Máx ${r.res[1]})`));
    const tagInf=noInfiltMission(m)?'(no permitidos)':'';
    const falta=state.preGame[p].res<r.res[0]?`<p class="pre-warn">Faltan ${r.res[0]-state.preGame[p].res} dado(s) en reserva (mínimo ${r.res[0]}).</p>`:'';
    return `<div class="pre-box"><h3 class="pre-title">${titulo}</h3>
      <p class="pre-total">Cantidad de dados total: <strong>${t}</strong></p>
      ${fila(p,'res','En Reserva',tagRes)}${fila(p,'inf','Infiltradores',tagInf)}${fila(p,'trn','En Transportes','')}
      <div class="pre-wave">Primera oleada: <strong>${preWave(p)}</strong></div>${falta}</div>`;
  };
  view.innerHTML=`<section class="panel"><h2>Despliegue inicial</h2>
  <p class="flow-intro"><strong>${tipo}</strong>${regla?'<br>'+regla:''}</p>
  ${extra.map(x=>`<p class="pre-note">${x}</p>`).join('')}
  <div class="pre-grid">${caja('p1',1)}${caja('p2',2)}</div>
  <p class="pre-note pre-note-end">Estos datos son solo de la prepartida: en la Ronda 1 la bolsa lleva todos los dados.</p>
  <div class="choice-row"><button class="pre-continue" data-action="pre-continue" ${preValid()?'':'disabled'}>CONTINUAR</button></div></section>${backButton()}`;
}

function newBag(){state.roundStart1=state.remaining1;state.roundStart2=state.remaining2;state.countLimitNotice='';state.bag=[];for(let i=0;i<state.remaining1;i++)state.bag.push('p1');for(let i=0;i<state.remaining2;i++)state.bag.push('p2');state.bag.sort(()=>Math.random()-.5);state.drawn=[];state.last=null;state.reveal=false;state.removeDieOpen=false}
// begin(): se ejecuta al pulsar CONTINUAR en la configuración. Arranca el reloj,
// guarda nombres (si están vacíos usa 'Jugador 1/2') y limita los dados entre 1 y 18.
function begin(){state.timerStartedAt=Date.now();
state.timerStoppedAt=null;state.p1=$('#p1').value.trim()||'Jugador 1';state.p2=$('#p2').value.trim()||'Jugador 2';state.d1=clamp(state.d1,1,50);
state.d2=clamp(state.d2,1,50);state.remaining1=state.d1;state.remaining2=state.d2;state.roundStart1=state.d1;state.roundStart2=state.d2;state.countLimitNotice='';state.round=1;
state.winner=null;
state.score1=0;
state.score2=0;
state.scoreApplied=false;
state.active=true;state.deploymentPhase=null;state.bag=[];state.drawn=[];state.removeDieOpen=false;state.flankingEnabled=false;state.flankChoices={p1:null,p2:null};state.flankRevealed={p1:false,p2:false};state.flankStep=1;state.flankModal=false;state.flankSelected=null;state.flankPendingChoice=null;state.matchSetup={};state.preGame=null;state.launched=false;state.screenBeforePause=null;state.screen='auto-ask';render()}
// clamp(valor, mín, máx): mantiene un número dentro de un rango.
// ¡Aquí no cambia el máximo! El 18 está en las llamadas clamp(…,1,18).
function clamp(v,a,b){return Math.max(a,Math.min(b,Number.isFinite(v)?v:a))}
// startRound(): empieza una ronda (prepara la bolsa y va a la extracción).
function startRound(){newBag();state.screen='draw';render()}
// nextDie(): saca un dado de la bolsa (con una pequeña pausa para la animación de la cortina).
function nextDie(){
 if(!state.bag.length)return;
 state.resumeNotice=false;
 const curtain=$('#curtain');if(curtain){curtain.classList.remove('lift');curtain.style.transform='translateY(0)'}
 save();
 setTimeout(()=>{
  if(state.screen!=='draw'||!state.bag.length)return;
  const who=state.bag.shift();state.drawn.push(who);if(state.deploymentPhase!=='first-wave'){if(who==='p1')state.remaining1--;else state.remaining2--;}
  state.last=who;save();render();
  const c=$('#curtain');if(c)requestAnimationFrame(()=>c.classList.add('lift'));
 },120);
}
// endRound(): cuando la bolsa está vacía, pasa a 'RONDA FINALIZADA'.
function endRound(){
 if(state.bag.length)return;
 if(state.deploymentPhase==='first-wave'){state.screen='infiltrator-title';state.removeDieOpen=false;save();render();return;}

 // Preparar la puntuación de la nueva ronda.
 state.roundScore1=0;
 state.roundScore2=0;
 state.scoreApplied=false;

 state.screen='round-finished';
 save();
 render();
}
// continueRound(): tras la ronda. Si era la 7, termina la partida y para el reloj;
// si no, va a la pantalla para indicar los dados de la siguiente ronda.
function continueRound(){

 if(state.scoreApplied)return;

 // Sumar los puntos de esta ronda al marcador total.
 state.score1+=Number(state.roundScore1||0);
 state.score2+=Number(state.roundScore2||0);

 // Marcar la puntuación como aplicada para evitar duplicados.
 state.scoreApplied=true;

 // Preparar los puntos provisionales de la siguiente ronda.
 state.roundScore1=0;
 state.roundScore2=0;

 if(state.round===7){
  state.timerStoppedAt=Date.now();
  state.screen='winner';
 }else if(state.round===6){
  // Tras el recuento de la ronda 6 se pregunta si hay turno 7 (los dados se cuentan solo si lo hay)
  state.screen='finish-choice';
 }else{
  state.remaining1=0;
  state.remaining2=0;
  state.screen='count';
 }

 save();
 render();
}
// confirmCount(): confirma los dados y pasa a la siguiente ronda (la pregunta del turno 7 ya se hizo antes).
function confirmCount(){state.round++;state.screen='round-title';render()}
// ----- REINICIAR PARTIDA (ventana de confirmación definida en index.html) ------
// resetMatch abre la ventana · closeResetModal la cierra · confirmResetMatch borra todo.
function resetMatch(){const modal=$('#resetConfirmModal');if(modal)modal.classList.add('open')}
function closeResetModal(){const modal=$('#resetConfirmModal');if(modal)modal.classList.remove('open')}
function confirmResetMatch(){closeResetModal();localStorage.removeItem('ba_state');state=initialState();render();updateGlobalClock() }
// resetFinished(): botón VOLVER de la pantalla final; vuelve al inicio y reinicia el reloj.
function resetFinished(){
 state.screen='home';
 state.screenBeforePause=null;
 state.timerStartedAt=null;
 state.timerStoppedAt=null;
 render();
}
// =============================================================================
// EVENTOS (escuchan lo que hace el usuario)
// =============================================================================
// Al escribir en los campos de nombre se guarda automáticamente.
view.addEventListener('input',e=>{
 const el=e.target;
 if(el.id==='p1'){state.p1=el.value;save()}
 else if(el.id==='p2'){state.p2=el.value;save()}
else if(el.id==='d1'){state.d1=clamp(+el.value,1,50);save()}
else if(el.id==='d2'){state.d2=clamp(+el.value,1,50);save()}
});
// Botón 'atrás' del navegador/móvil: vuelve a la pantalla anterior de la app.
window.addEventListener('popstate',e=>{

  if(!e.state || !e.state.boltAction) return;

  appHistoryDepth = Math.max(0,appHistoryDepth-1);

  state.screen = e.state.screen;
  lastRenderedScreen = state.screen;

  render();

});
// Recuerda la posición del scroll para volver al mismo punto al recargar.
window.addEventListener('scroll',()=>{state.scrollY=window.scrollY;save()},{passive:true});
window.addEventListener('pagehide',()=>{state.scrollY=window.scrollY;save()});
window.addEventListener('beforeunload',()=>{state.scrollY=window.scrollY;save()});
// Botones de la ventana '¿REINICIAR PARTIDA?' (SÍ / NO / clic fuera para cerrar).
document.getElementById('resetConfirmModal').addEventListener('click',e=>{
 const choice=e.target.closest('[data-reset-choice]');
 if(!choice){if(e.target.id==='resetConfirmModal')closeResetModal();return;}
 if(choice.dataset.resetChoice==='yes')confirmResetMatch();else closeResetModal();
});
// =============================================================================
// CLICS: qué hace cada botón. Se identifica por su atributo data-action="..."
// (o data-faction, data-rule-category, data-scenario…). Para un botón nuevo:
// 1) ponle data-action="mi-accion"  2) añade aquí un 'else if(a===\'mi-accion\')'.
// =============================================================================
view.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 const a=b.dataset.action;
 // COMENZAR PARTIDA (inicio): si hay una partida en curso, pide confirmación antes de seguir
 if(a==='start'){if(hasGameInProgress()){startWarnOpen=true;render()}else{state.screen='setup';render()}}
 else if(a==='start-confirm'){startWarnOpen=false;state.screen='setup';render()}   // SÍ del aviso
 else if(a==='start-cancel'){startWarnOpen=false;render()}                          // NO del aviso: no pasa nada
 else if(a==='scenario-groups'){state.screen='scenario-groups';render()}
 else if(a==='deployment-menu'){state.screen='deployment-menu';render()}
    else if(a==='zones-menu'){
 state.screen='zones-menu';
 render();
}
 else if(a==='rules-menu'){state.screen='rules-menu';render()}
 else if(a==='factions'){state.screen='factions';render()}
 else if(a==='rules-pdf'){state.screen='rules-pdf';render()}   // abre REFERENCIA REGLAS
 else if(a==='resume'){state.screen=state.screenBeforePause||(state.bag&&state.bag.length?'draw':'round-title');state.resumeNotice=true;render()}
 else if(a==='go-home'){if(['draw','round-title','round-finished','count','finish-choice','winner','auto-ask','auto-mode','zone-pick','deploy-pick','auto-result','predeploy'].includes(state.screen))state.screenBeforePause=state.screen;state.screen='home';render()}
 // Botón REINICIAR PARTIDA y navegación Volver / Inicio / Continuar
 else if(a==='reset')resetMatch()
  else if(a==='back'){
  if(appHistoryDepth > 0){
    history.back();
  }else if(state.screen !== 'home'){
    state.screen = 'home';
    render();
  }
}

// Botón CONTINUAR de la configuración, y botones − / + de los dados iniciales
else if(a==='begin'){
  begin();
}
else if(b.dataset.diceAdjust){
  const key=b.dataset.diceAdjust;
  const delta=Number(b.dataset.delta);
state[key]=clamp(state[key]+delta,1,50);
   render();
}
 // --- Nueva partida: elección automática / manual de misión y despliegue ---
 else if(a==='auto-yes'){state.screen='auto-mode';render()}
 else if(a==='auto-no'||a==='auto-manual'){state.matchSetup={};state.screen='zone-pick';render()}
 else if(a==='pick-zone'){state.matchSetup=state.matchSetup||{};state.matchSetup.zone=b.dataset.zone;state.screen='deploy-pick';render()}
 else if(a==='pick-deploy'){state.matchSetup=state.matchSetup||{};state.matchSetup.deploy=b.dataset.deploy;state.screen='auto-result';render()}   // resumen antes de empezar
 else if(a==='auto-base'){state.matchSetup=rollBase();state.screen='auto-result';render()}
 else if(a==='auto-pack'){state.matchSetup=rollPack();state.screen='auto-result';render()}
 else if(a==='auto-both'){state.matchSetup=rollBoth();state.screen='auto-result';render()}
 else if(a==='launch')launchMatch()
 else if(a==='pre-adj')preAdjust(b.dataset.p,b.dataset.k,+b.dataset.d)   // − / + de la prepartida
 else if(a==='pre-continue'){if(preValid()){if(noReserveMission(state.matchSetup||{}))startRound1();else startFirstWave()}} // Ruptura no tiene fase de primera oleada
 else if(a==='start-round-1')startRound1()                              // SIGUIENTE → Ronda 1
 // --- Flanqueo ---
 else if(a==='flanking-yes'){state.flankingEnabled=true;state.flankStep=1;state.screen='flanking-choose';render()}
 else if(a==='flanking-no'){state.flankingEnabled=false;state.screen='generating';render()}
 else if(a==='choose-left'||a==='choose-right'){state.flankPendingChoice=a==='choose-left'?'left':'right';render()}
 else if(a==='confirm-flank-choice'){if(!state.flankPendingChoice)return;const who=state.flankStep===1?'p1':'p2';state.flankChoices[who]=state.flankPendingChoice;state.flankPendingChoice=null;if(state.flankStep===1){state.flankStep=2;render()}else{state.screen='generating';render()}}
 else if(a==='open-flank-reveal'){state.flankModal=true;state.flankSelected=null;render()}
 else if(a==='select-flank-p1'||a==='select-flank-p2'){state.flankSelected=a.endsWith('p1')?'p1':'p2';render()}
 else if(a==='confirm-flank-reveal'){if(state.flankSelected&&state.flankChoices[state.flankSelected])state.flankRevealed[state.flankSelected]=true;state.flankModal=false;state.flankSelected=null;render()}
 else if(a==='cancel-flank'){state.flankModal=false;state.flankSelected=null;render()}
 // --- Desarrollo de la ronda: empezar, sacar dado, eliminar dado, terminar ---
 else if(a==='start-round')startRound()
 else if(a==='next-die')nextDie()
 else if(a==='open-remove-die'){state.removeDieOpen=true;render()}
 else if(a==='cancel-remove-die'){state.removeDieOpen=false;render()}
 else if(a==='remove-p1'||a==='remove-p2'){
  const who=a==='remove-p1'?'p1':'p2';
  const index=state.bag.indexOf(who);
  if(index!==-1){state.bag.splice(index,1);state.removeDieOpen=false;save();render()}
 }
else if(b.dataset.score){
  const key=b.dataset.score==='p1'?'roundScore1':'roundScore2';

  if(state.screen==='round-finished' && !state.scoreApplied){
    state[key]=Math.max(0,Number(state[key]||0)+Number(b.dataset.delta));
    save();
    render();
  }
}
 else if(a==='end-round')endRound()
 else if(a==='continue-round')continueRound()
 else if(a==='confirm-count')confirmCount()
else if(a==='end-match'){
 state.timerStoppedAt=Date.now();
 state.screen='winner';
 render();
}
 else if(a==='round-seven'){state.remaining1=0;state.remaining2=0;state.countLimitNotice='';state.screen='count';render()}   // turno 7: primero se cuentan los dados
 // --- Pantalla final: elegir resultado y volver ---
 else if(a==='win-p1'){state.winner=state.p1;render()}
 else if(a==='win-p2'){state.winner=state.p2;render()}
 else if(a==='win-draw'){state.winner='EMPATE';render()}
 else if(a==='home-finished')resetFinished()
 // --- Botones de listas (facciones, reglas, despliegue, escenarios) y ajuste de dados ---
 else if(b.dataset.faction){state.factionName=b.dataset.faction;state.screen='faction-detail';render()}
 else if(b.dataset.ruleCategory){state.ruleCategory=b.dataset.ruleCategory;state.screen='rules-list';render()}
 else if(b.dataset.ruleName){state.ruleName=b.dataset.ruleName;state.screen='rules-detail';render()}
 else if(b.dataset.deployment){state.deploymentType=b.dataset.deployment;state.screen='deployment-detail';render()}
    else if(b.dataset.zone){
 state.zoneImage=b.dataset.zone;
 state.screen='zone-detail';
 render();
}
 else if(b.dataset.group){state.group=b.dataset.group;if(b.dataset.group==='ESCENARIOS JUEGO BASE')state.screen='base-scenario-list';else state.screen='scenario-list';render()}
 else if(b.dataset.baseScenario){state.baseScenario=b.dataset.baseScenario;state.screen='base-scenario-detail';render()}
 else if(b.dataset.scenario){state.scenario=b.dataset.scenario;state.screen='scenario-detail';render()}
 else if(b.dataset.adjust){const player=b.dataset.adjust, key=player==='p1'?'remaining1':'remaining2',limit=player==='p1'?state.roundStart1:state.roundStart2,next=state[key]+Number(b.dataset.delta);if(next>limit){state.countLimitNotice='Sin refuerzos: no puedes tener más dados de orden que al empezar la ronda.';}else{state[key]=clamp(next,0,limit);state.countLimitNotice='';}render()}
});
render();
updateGlobalClock();
// El reloj se refresca 4 veces por segundo.
setInterval(updateGlobalClock,250);
// Restaura la posición del scroll guardada.
requestAnimationFrame(()=>{if(Number.isFinite(state.scrollY)&&state.scrollY>0)window.scrollTo(0,state.scrollY)});

