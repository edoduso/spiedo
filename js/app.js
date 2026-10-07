/**
 * APP  ·  interfaccia di spiEDO.
 *
 * Struttura del file:
 *   1. Stato e riferimenti
 *   2. Utilità UI (tag, toast, suoni, schermo acceso)
 *   3. Schermata IMPOSTA   (htmlImposta)
 *   4. Schermata DOSI      (htmlDosi)
 *   5. Schermata COTTURA   (htmlCottura + aggiornamento live)
 *   6. Sheet del calendario
 *   7. Azioni (un solo punto per tutti i click)
 *   8. Ciclo di aggiornamento (ogni secondo) e avvio
 *
 * Dosi, tempi e testi non sono qui: stanno in ricetta.js.
 */
import { GENERALI, MODALITA, TAG, CATEGORIE_CALENDARIO, INGREDIENTI, PASSI_AGGIUSTAMENTO } from './ricetta.js';
import { calcolaDosi, costruisciTimeline, fasePerMinuto, statoEvento, oraServizio, avvioPerServire, durataCottura } from './calcoli.js';
import { contaPerCategoria, eventiSelezionati, generaICS, consegnaICS } from './calendario.js';
import { carica, salva, statoIniziale } from './stato.js';
import { HERO_SPIEDO, FIAMMA, pittogramma } from './illustrazioni.js';
import * as U from './utils.js';

/* ========================================================== 1. STATO ==== */

let S = carica();

const $ = (sel, radice = document) => radice.querySelector(sel);
const app = $('#app');
const viste = { imposta: $('#vista-imposta'), dosi: $('#vista-dosi'), cottura: $('#vista-cottura') };
const NOMI_VISTE = Object.keys(viste);

/* Stato della sola interfaccia (non salvato). Serve perché le schermate vengono ridisegnate
   a ogni modifica: senza questo, i pannelli <details> si richiuderebbero a ogni tocco. */
let avanzateAperte = false;
let passatiAperti = false;
let modificaDosiAttiva = false;
let appenaFatto = null;        // id dell'ultimo passo segnato: serve solo per l'animazione della spunta

const riduciMovimento = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

document.addEventListener('toggle', (evento) => {
  if (evento.target.id === 'avanzate') avanzateAperte = evento.target.open;
  if (evento.target.id === 'passati') passatiAperti = evento.target.open;
}, true);

/** Ricalcola dosi e timeline dallo stato corrente. */
const calcola = () => ({ dosi: calcolaDosi(S), tl: costruisciTimeline(S) });

function modifica(cambia) {
  cambia(S);
  salva(S);
}

/* ===================================================== 2. UTILITÀ UI ==== */

const icona = (id, classe = '') => `<svg class="ico ${classe}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const icoPitto = (id) => `<svg class="ico pitto" aria-hidden="true"><use href="#p-${id}"/></svg>`;

const tagHtml = (chiave) => {
  const t = TAG[chiave];
  return t ? `<span class="tag tag--${t.classe}">${t.etichetta}</span>` : '';
};
const titoloEvento = (e) => `${e.titolo}${e.totale > 1 ? ` <small>${e.numero}/${e.totale}</small>` : ''}`;
const titoloPiano = (e) => `${e.titolo}${e.totale > 1 ? ` ${e.numero}/${e.totale}` : ''}`;

/* ---- avvisi a schermo ---- */
function toast(testo, { allarme = false, durata = 3200, icon = 'check' } = {}) {
  const el = document.createElement('div');
  el.className = `toast${allarme ? ' toast--allarme' : ''}`;
  el.innerHTML = `${icona(icon)}<span>${testo}</span>`;
  $('#toast-root').appendChild(el);
  setTimeout(() => el.remove(), durata);
}

/* ---- suono e vibrazione (il suono richiede un tocco dell'utente per sbloccarsi) ---- */
let audio = null;
function sbloccaAudio() {
  try {
    audio = audio ?? new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch (e) { /* audio non disponibile */ }
}
document.addEventListener('pointerdown', sbloccaAudio, { once: true });

function suona() {
  if (!S.suoni) return;
  try { navigator.vibrate?.([220, 110, 220]); } catch (e) { /* ignora */ }
  if (!audio) return;
  const t0 = audio.currentTime;
  [0, 0.28, 0.56].forEach((ritardo) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, t0 + ritardo);
    gain.gain.exponentialRampToValueAtTime(0.35, t0 + ritardo + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + ritardo + 0.22);
    osc.connect(gain).connect(audio.destination);
    osc.start(t0 + ritardo);
    osc.stop(t0 + ritardo + 0.25);
  });
}

/* ---- schermo sempre acceso durante la cottura ---- */
let wake = null;
async function aggiornaWake(adesso = Date.now()) {
  if (!('wakeLock' in navigator)) return;
  const { tl } = calcola();
  const attiva = S.schermoAcceso && S.avvio && adesso > S.avvio - 60 * 60000 && adesso < S.avvio + (tl.durata + 30) * 60000;
  try {
    if (attiva && !wake && document.visibilityState === 'visible') {
      wake = await navigator.wakeLock.request('screen');
      wake.addEventListener('release', () => { wake = null; });
    } else if (!attiva && wake) {
      await wake.release();
      wake = null;
    }
  } catch (e) { wake = null; }
}

/* ============================================== 3. SCHERMATA IMPOSTA ==== */

let promptInstalla = null; // evento beforeinstallprompt (Android/Chrome)
const eIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const eInstallata = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

function stepperCompatto(etichetta, valore, unita, azione) {
  return `
    <div class="campo">
      <label>${etichetta}</label>
      <div class="stepper stepper--compatto">
        <button class="rotondo" data-azione="${azione}" data-delta="-1" aria-label="${etichetta}: meno">${icona('meno')}</button>
        <div class="stepper__valore"><div class="numero-medio">${valore}</div><div class="stepper__unita">${unita}</div></div>
        <button class="rotondo" data-azione="${azione}" data-delta="1" aria-label="${etichetta}: più">${icona('piu')}</button>
      </div>
    </div>`;
}

function htmlCapacita(cap) {
  const larg = Math.min(100, cap.percentuale);
  const testo = cap.ok
    ? `Ci sta: ${cap.prese} prese su ${cap.max} (${cap.percentuale}%), circa ${cap.perRaspa} per raspa.`
    : `Non ci sta: ${cap.prese} prese su ${cap.max}.`;
  const regge = cap.personeMax > 0 ? ` Questo spiedo regge fino a ${cap.personeMax} persone.` : '';
  return `
    <div class="capacita ${cap.ok ? '' : 'capacita--troppo'}">
      <div class="capacita__barra" role="img" aria-label="Riempimento dello spiedo ${cap.percentuale}%"><span style="width:${larg}%"></span></div>
      <p class="capacita__testo">${testo}${regge}</p>
    </div>`;
}

function htmlInstalla() {
  if (eInstallata) return '';
  if (promptInstalla) {
    return `
      <div class="card card--tratteggio">
        <div class="card__titolo">${icona('installa')}Tienilo sul telefono</div>
        <p class="sottotitolo">Installato funziona anche senza rete, a schermo intero, con la sua icona.</p>
        <button class="bottone mt-m" data-azione="installa">Installa spiEDO</button>
      </div>`;
  }
  if (eIOS) {
    return `
      <div class="card card--tratteggio">
        <div class="card__titolo">${icona('installa')}Tienilo sul telefono</div>
        <p class="sottotitolo">Da Safari tocca <b>Condividi</b>, poi <b>Aggiungi a Home</b>. Si apre a schermo intero e funziona anche senza rete.</p>
      </div>`;
  }
  return '';
}

function htmlPartenzaInfo(tl) {
  if (!S.avvio) {
    return `<p class="sottotitolo mt-m" id="partenza-info">Scegli quando parte lo spiedo e l'app calcola tutto il resto.</p>`;
  }
  const t0 = S.avvio;
  const fine = t0 + tl.durata * 60000;
  const righe = [];
  righe.push(['Lo spiedo gira', `${U.dataBreve(t0)} ${U.oraHM(t0)}`]);
  righe.push(['Cottura finita', U.oraHM(fine)]);
  righe.push(['Si mangia', U.oraHM(oraServizio(t0, tl.durata))]);
  return `
    <div class="partenza-info" id="partenza-info">
      ${righe.map(([k, v]) => `<div class="partenza-info__riga"><span>${k}</span><b>${v}</b></div>`).join('')}
    </div>`;
}

function htmlImposta({ dosi, tl }) {
  const m = MODALITA[S.modo];
  const durata = tl.durata;
  const durataModificata = S.durataMin !== null;
  return `
  <div class="pila">

    <div class="hero">
      <h1 class="hero__marchio">spi<b>EDO</b></h1>
      <p class="hero__testo">Dosi, procedimento e tempistiche.</p>
      <div class="hero__illu">${HERO_SPIEDO}</div>
    </div>

    <div class="card">
      <div class="card__titolo">${icona('persone')}Quanti siete?</div>
      <div class="stepper">
        <button class="rotondo" data-azione="persone" data-delta="-1" aria-label="Una persona in meno">${icona('meno')}</button>
        <div class="stepper__valore">
          <input class="numero-grande" id="in-persone" type="number" inputmode="numeric" min="${GENERALI.persone.min}" max="${GENERALI.persone.max}" value="${S.persone}" aria-label="Numero di persone">
          <div class="stepper__unita">persone</div>
        </div>
        <button class="rotondo" data-azione="persone" data-delta="1" aria-label="Una persona in più">${icona('piu')}</button>
      </div>
    </div>

    <div class="card">
      <div class="card__titolo">${icona('fuoco')}Come cuoci?</div>
      <div class="scelte scelte--3" role="group" aria-label="Fonte di calore">
        ${Object.values(MODALITA).map((x) => `
          <button class="chip" data-azione="modo" data-valore="${x.id}" aria-pressed="${S.modo === x.id}">${x.nome}</button>`).join('')}
      </div>
      <p class="sottotitolo mt-m">Cottura stimata: circa <b>${U.durataTesto(durata)}</b>.</p>
    </div>

    <div class="card">
      <div class="card__titolo">${icona('piu')}Extra</div>
      <div class="scelte" role="group" aria-label="Carni opzionali">
        ${INGREDIENTI.carni.filter((c) => c.opzionale).map((c) => `
          <button class="chip" data-azione="extra" data-valore="${c.id}" aria-pressed="${!!S.extra[c.id]}">${icoPitto(c.id)}${c.nome}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card__titolo">${icona('spiedo')}Il tuo spiedo</div>
      <div class="campi" style="grid-template-columns:1fr 1fr">
        ${stepperCompatto('Raspe', S.spiedo.raspe, 'raspe', 'raspe')}
        ${stepperCompatto('Lunghezza raspa', S.spiedo.lunghezzaCm, 'cm', 'lunghezza')}
      </div>
      <div id="capacita">${htmlCapacita(dosi.capacita)}</div>
    </div>

    <div class="card">
      <div class="card__titolo">${icona('orologio')}Quando parti?</div>
      <div class="campi campi--colonna">
        <div class="campo">
          <label for="in-avvio">Lo spiedo gira</label>
          <input type="datetime-local" id="in-avvio" value="${S.avvio ? U.perDatetimeLocal(S.avvio) : ''}">
        </div>
        <div class="campo">
          <label for="in-servizio">Si mangia alle</label>
          <input type="time" id="in-servizio" value="${S.avvio ? U.perTime(oraServizio(S.avvio, durata)) : ''}">
        </div>
      </div>
      <div id="partenza-box">${htmlPartenzaInfo(tl)}</div>
      <div class="pila mt-m" style="gap:8px">
        <button class="bottone bottone--lime" data-azione="parti-ora">${icona('via')}Parti adesso</button>
        <button class="bottone ${S.avvio ? '' : 'nascosto'}" id="btn-conferma" data-azione="conferma">Conferma e vai alla cottura</button>
      </div>
    </div>

    <details class="card" id="avanzate" ${avanzateAperte ? 'open' : ''}>
      <summary>Opzioni avanzate</summary>
      <div class="avanzate">
        <div>
          <div class="riga__titolo">Unta di nuovo ogni</div>
          <div class="scelte scelte--4 mt-s" role="group" aria-label="Intervallo del burro">
            ${GENERALI.burroOgniOpzioni.map((n) => `<button class="chip" data-azione="burro-ogni" data-valore="${n}" aria-pressed="${S.burroOgniMin === n}">${n}'</button>`).join('')}
          </div>
        </div>
        <div>
          <div class="riga">
            <div class="riga__testo"><div class="riga__titolo">Durata della cottura</div>
              <div class="riga__aiuto">${durataModificata ? 'Modificata a mano' : 'Standard per ' + m.nome.toLowerCase()}</div></div>
            <div class="stepper stepper--compatto" style="width:160px">
              <button class="rotondo" data-azione="durata" data-delta="-15" aria-label="Quindici minuti in meno">${icona('meno')}</button>
              <div class="stepper__valore"><div class="numero-medio" style="font-size:18px">${U.durataTesto(durata)}</div></div>
              <button class="rotondo" data-azione="durata" data-delta="15" aria-label="Quindici minuti in più">${icona('piu')}</button>
            </div>
          </div>
          ${durataModificata ? `<button class="chip mt-s" data-azione="durata-reset">Torna alla durata standard</button>` : ''}
        </div>
        <div>
          <div class="riga__titolo">Avviso in calendario</div>
          <div class="scelte scelte--3 mt-s" role="group" aria-label="Preavviso">
            ${GENERALI.preavvisoOpzioni.map((n) => `<button class="chip" data-azione="preavviso" data-valore="${n}" aria-pressed="${S.calendario.preavvisoMin === n}">${n === 0 ? 'Al momento' : n + ' min prima'}</button>`).join('')}
          </div>
        </div>
        <div class="riga">
          <div class="riga__testo"><div class="riga__titolo">Suono e vibrazione</div><div class="riga__aiuto">Quando scatta un promemoria, con l'app aperta</div></div>
          <button class="interruttore" role="switch" aria-checked="${S.suoni}" aria-label="Suono e vibrazione" data-azione="interruttore" data-valore="suoni"></button>
        </div>
        <button class="chip" data-azione="ripristina">${icona('reset', 'ico--s')}Ripristina tutte le impostazioni</button>
      </div>
    </details>

    ${htmlInstalla()}
  </div>`;
}

/* ================================================== 4. SCHERMATA DOSI === */

/** Unità mostrata accanto al passo di correzione (tasti + e -). */
const UNITA_PASSO = { salvia: 'foglie', burro: 'g', sale: 'g', patate: 'g' };

function htmlDosi({ dosi }) {
  const haCorrezioni = Object.values(dosi.correzioni).some((c) => c !== 0);

  /** Una riga: icona, nome e quantità. In modalità "Modifica" compaiono i tasti - e +. */
  const riga = ({ id, icona: ico, nome, num, sub = [], extra = false }) => {
    const c = dosi.correzioni[id] ?? 0;
    const unita = UNITA_PASSO[id] ?? 'pz';
    const badge = c ? `<div class="ingrediente__sub"><span class="correzione">${c > 0 ? '+' : '-'}${Math.abs(c)} ${unita}</span></div>` : '';
    const editor = modificaDosiAttiva ? `
      <div class="ingrediente__modifica">
        <button class="rotondo rotondo--m" data-azione="aggiusta" data-id="${id}" data-delta="-1" aria-label="Meno ${nome}">${icona('meno')}</button>
        <span class="ingrediente__passo">${PASSI_AGGIUSTAMENTO[id] ?? 1} ${unita} per tocco</span>
        <button class="rotondo rotondo--m" data-azione="aggiusta" data-id="${id}" data-delta="1" aria-label="Più ${nome}">${icona('piu')}</button>
      </div>` : '';
    return `
    <div class="ingrediente ${extra ? 'ingrediente--extra' : ''}">
      <div class="ingrediente__icona">${ico}</div>
      <div class="ingrediente__nome">${nome}</div>
      <div class="ingrediente__qta">
        <div class="ingrediente__num">${num}</div>
        ${sub.map((t) => `<div class="ingrediente__sub">${t}</div>`).join('')}
        ${badge}
      </div>
      ${editor}
    </div>`;
  };

  const carni = dosi.righe.map((r) => riga({
    id: r.id,
    icona: pittogramma(r.id),
    nome: r.nome,
    num: r.pezzi,
    sub: [r.unita, U.grammi(r.grammi), ...(r.capo ? [r.capo] : [])],
    extra: r.opzionale,
  })).join('');

  const nbsp = (testo) => testo.replace(' ', '&nbsp;');

  return `
  <div class="pila">
    <div class="testata">
      <h2 class="titolo-sezione">Per ${dosi.persone} ${dosi.persone === 1 ? 'persona' : 'persone'}</h2>
      <p class="sottotitolo">${MODALITA[S.modo].nome}, ${U.durataTesto(durataCottura(S))} di cottura. Quantità a crudo.</p>
    </div>

    <div class="riepilogo-dosi">
      <div class="cifra"><div class="cifra__num">${dosi.prese}</div><div class="cifra__etichetta">prese</div></div>
      <div class="cifra"><div class="cifra__num">${nbsp(U.grammi(Math.round(dosi.pesoCarneG / 100) * 100))}</div><div class="cifra__etichetta">di carne</div></div>
      <div class="cifra"><div class="cifra__num">${nbsp(U.grammi(dosi.burro.totale))}</div><div class="cifra__etichetta">di burro</div></div>
    </div>

    <div class="scelte">
      <button class="chip" data-azione="modifica-dosi" aria-pressed="${modificaDosiAttiva}">${modificaDosiAttiva ? 'Fatto' : 'Modifica quantità'}</button>
      ${haCorrezioni ? `<button class="chip" data-azione="aggiusta-reset">${icona('reset', 'ico--s')}Azzera modifiche</button>` : ''}
    </div>

    <div>
      ${carni}
      ${riga({ id: 'patate', icona: pittogramma('patate'), nome: 'Patate', num: nbsp(U.grammi(dosi.patate.grammi)), sub: [`circa ${dosi.patate.pezzi} patate`] })}
      ${riga({ id: 'salvia', icona: pittogramma('foglia'), nome: 'Salvia', num: dosi.salviaFoglie, sub: ['foglie'] })}
      ${riga({ id: 'burro', icona: pittogramma('burro'), nome: 'Burro', num: nbsp(U.grammi(dosi.burro.totale)) })}
      ${riga({ id: 'sale', icona: pittogramma('sale'), nome: 'Sale fino', num: nbsp(U.grammi(dosi.sale.totale)), sub: [`2 salature da ${nbsp(U.grammi(dosi.sale.meta))}`] })}
    </div>
  </div>`;
}

/* ================================================ 5. SCHERMATA COTTURA == */

/** Fotografia di "dove siamo" rispetto alla cottura, a un certo istante. */
function statoLive(adesso, tl) {
  const t0 = S.avvio;
  const min = (adesso - t0) / 60000;
  const fine = t0 + tl.durata * 60000;
  const fase = adesso < t0 ? null : fasePerMinuto(tl.profilo, min);
  const stato = adesso < t0 ? 'prima' : adesso >= fine ? 'finita' : 'incorso';
  const statiEv = tl.eventi.map((e) => statoEvento(e, t0, adesso, S.fatti));
  const prossimo = tl.eventi.find((_, i) => statiEv[i] === 'futuro') ?? null;
  const daFare = tl.eventi.filter((_, i) => statiEv[i] === 'ora');
  return { t0, min, fine, fase, stato, statiEv, prossimo, daFare };
}

function htmlVuoto() {
  return `
  <div class="pila">
    <div class="vuoto">
      ${FIAMMA}
      <h2 class="titolo-sezione">Nessuna cottura in corso</h2>
      <p class="sottotitolo">Scegli quando parte lo spiedo e qui compare la timeline, con i promemoria e le temperature.</p>
      <div class="pila" style="width:100%;gap:8px">
        <button class="bottone bottone--lime" data-azione="parti-ora">${icona('via')}Parti adesso</button>
        <button class="bottone bottone--contorno" data-azione="vai" data-vista="imposta">Scegli l'orario</button>
      </div>
    </div>
  </div>`;
}

function htmlEventoOra(e) {
  return `
    <div class="evento-ora">
      <div>
        ${tagHtml(e.tag)}
        <h3 class="evento-ora__titolo">${titoloEvento(e)}</h3>
      </div>
      <button class="cerchio" data-azione="fatto" data-id="${e.id}" aria-pressed="false" aria-label="Segna come fatto: ${titoloPiano(e)}">${icona('check')}</button>
    </div>`;
}

function htmlRigaProgramma(e, st, live) {
  const t = live.t0 + e.min * 60000;
  const fatto = !!S.fatti[e.id];
  const classe = st === 'passato' ? 'prog-riga--passato' : st === 'ora' ? 'prog-riga--ora' : '';
  return `
    <div class="prog-riga ${classe}" data-riga="${e.id}">
      <div class="prog-riga__ora"><b>${U.oraHM(t)}</b><small>${U.offsetTesto(e.min)}</small></div>
      <div>
        ${tagHtml(e.tag)}
        <div class="prog-riga__titolo">${titoloPiano(e)}</div>
      </div>
      ${st === 'futuro' ? '<span></span>' : `<button class="cerchio cerchio--piccolo ${fatto && appenaFatto === e.id ? 'cerchio--pop' : ''}" data-azione="fatto" data-id="${e.id}" aria-pressed="${fatto}" aria-label="${fatto ? 'Fatto' : 'Segna come fatto'}: ${titoloPiano(e)}">${icona('check')}</button>`}
    </div>`;
}

/** Programma completo: i passati stanno in una sezione chiusa, così in cima c'è sempre il prossimo. */
function htmlProgramma(tl, live) {
  const passati = [];
  const attuali = [];
  tl.eventi.forEach((e, i) => (live.statiEv[i] === 'passato' ? passati : attuali).push(htmlRigaProgramma(e, live.statiEv[i], live)));
  return `
    ${passati.length ? `<details class="programma__passati" id="passati" ${passatiAperti ? 'open' : ''}><summary>Già passati (${passati.length})</summary>${passati.join('')}</details>` : ''}
    ${attuali.join('')}`;
}

function htmlCottura({ tl }) {
  if (!S.avvio) return htmlVuoto();
  const adesso = Date.now();
  const L = statoLive(adesso, tl);
  const fineTesto = U.oraHM(L.fine);
  const servizio = U.oraHM(oraServizio(L.t0, tl.durata));
  const etichetta = { prima: 'Si parte tra', incorso: 'In cottura da', finita: 'Finita da' }[L.stato];

  // A cottura finita compare solo il messaggio di chiusura (la fase corrente non ha una card propria).
  const fineCard = L.stato === 'finita' ? `
      <div class="card">
        <div class="card__titolo">${icona('fine')}Fatto</div>
        <div class="fine__titolo">Cottura completata</div>
        <p class="fine__nota">Sfila i pezzi dalle raspe e tieni il burro colato per la polenta.</p>
      </div>` : '';

  const prossimoCard = L.prossimo ? `
      <div class="card">
        <div class="card__titolo">${icona('orologio')}Prossimo</div>
        <div class="prossimo">
          <div>${tagHtml(L.prossimo.tag)}<div class="prossimo__titolo">${titoloPiano(L.prossimo)}</div></div>
          <div class="prossimo__quando"><b>${U.oraHM(L.t0 + L.prossimo.min * 60000)}</b><small id="prossimo-tra"></small></div>
        </div>
      </div>` : '';

  const daFareHtml = L.daFare.length ? `<div class="da-fare" id="da-fare">${L.daFare.map(htmlEventoOra).join('')}</div>` : '';

  const profiloHtml = `
    <div class="card">
      <div class="card__titolo">${icona('temp')}Temperature</div>
      <div class="profilo__barra" id="profilo-barra" role="img" aria-label="Profilo di cottura">
        ${tl.profilo.map((p) => {
          const stato = L.fase === p ? 'corrente' : L.min >= p.a ? 'passato' : '';
          return `<div class="profilo__seg ${stato}" style="flex:${p.a - p.da}"></div>`;
        }).join('')}
        <div class="profilo__marker" id="profilo-marker" style="left:${Math.min(100, Math.max(0, (L.min / tl.durata) * 100))}%"></div>
      </div>
      <div class="profilo__legenda">
        ${tl.profilo.map((p) => `
          <div class="profilo__voce ${L.fase === p ? 'corrente' : ''}">
            <div><b>${p.nome}</b> · ${p.temp}</div>
            <span>${U.oraHM(L.t0 + p.da * 60000)} - ${U.oraHM(L.t0 + p.a * 60000)}</span>
          </div>`).join('')}
      </div>
    </div>`;

  const conteggio = eventiCalendario(tl).length;

  return `
  <div class="pila">
    <div class="live">
      <div class="live__etichetta" id="live-etichetta">${etichetta}</div>
      <div class="live__clock" id="live-clock" role="timer">0:00:00</div>
      <div class="barra-prog" role="progressbar" aria-label="Avanzamento della cottura"><span id="live-prog"></span></div>
      <div class="live__fatti">
        <div class="live__fatto"><small>Gira dalle</small><b>${U.oraHM(L.t0)}</b></div>
        <div class="live__fatto"><small>Finisce</small><b>${fineTesto}</b></div>
        <div class="live__fatto"><small>Si mangia</small><b>${servizio}</b></div>
      </div>
    </div>

    ${daFareHtml}
    ${fineCard}
    ${prossimoCard}
    ${profiloHtml}

    <div class="card">
      <div class="card__titolo">${icona('dosi')}Tutto il programma</div>
      <div class="programma" id="programma">${htmlProgramma(tl, L)}</div>
    </div>

    <div class="card">
      <div class="card__titolo">${icona('cal')}Strumenti</div>
      <button class="bottone bottone--contorno" data-azione="calendario" ${conteggio === 0 ? 'disabled' : ''}>${icona('cal')}Promemoria in calendario</button>
      ${'wakeLock' in navigator ? `
      <div class="riga mt-m">
        <div class="riga__testo"><div class="riga__titolo">Schermo sempre acceso</div><div class="riga__aiuto">Durante la cottura</div></div>
        <button class="interruttore" role="switch" aria-checked="${S.schermoAcceso}" aria-label="Schermo sempre acceso" data-azione="interruttore" data-valore="schermoAcceso"></button>
      </div>` : ''}
      <div class="riga__titolo mt-l">Sposta la partenza</div>
      <div class="scelte scelte--4 mt-s">
        ${[-15, -5, 5, 15].map((n) => `<button class="chip" data-azione="sposta" data-delta="${n}">${n > 0 ? '+' : '-'}${Math.abs(n)}'</button>`).join('')}
      </div>
      <p class="riga__aiuto mt-s">Se sposti l'orario dopo aver creato i promemoria, ricrea il file dal pulsante qui sopra.</p>
      <button class="chip mt-l" data-azione="azzera">${icona('reset', 'ico--s')}Azzera la cottura</button>
    </div>
  </div>`;
}

/**
 * Aggiornamento "leggero" ogni secondo: cambia solo testi e larghezze,
 * senza ricostruire la pagina (così niente sfarfallii né focus persi).
 */
let firmaCottura = '';
function aggiornaLive(adesso) {
  if (!S.avvio) { aggiornaTabAvviso(null); return; }
  const { tl } = calcola();
  const L = statoLive(adesso, tl);

  // se è cambiato qualcosa di strutturale (evento scaduto, fase, stato) si ricostruisce la vista
  const firma = [L.stato, L.fase?.nome, L.daFare.map((e) => e.id).join(','), L.prossimo?.id, S.avvio, JSON.stringify(S.fatti)].join('|');
  if (firma !== firmaCottura) {
    firmaCottura = firma;
    disegna('cottura');
    aggiornaTabAvviso(L);
  }

  const clock = $('#live-clock');
  if (!clock) return;
  const durataMs = tl.durata * 60000;
  if (L.stato === 'prima') clock.textContent = U.cronometro(L.t0 - adesso);
  else if (L.stato === 'incorso') clock.textContent = U.cronometro(adesso - L.t0);
  else clock.textContent = U.cronometro(adesso - L.fine);
  const prog = $('#live-prog');
  if (prog) prog.style.width = `${Math.min(100, Math.max(0, ((adesso - L.t0) / durataMs) * 100))}%`;
  const marker = $('#profilo-marker');
  if (marker) marker.style.left = `${Math.min(100, Math.max(0, (L.min / tl.durata) * 100))}%`;
  const tra = $('#prossimo-tra');
  if (tra && L.prossimo) tra.textContent = `tra ${U.cronometro(L.t0 + L.prossimo.min * 60000 - adesso)}`;
}

function aggiornaTabAvviso(L) {
  $('#tab-cottura').dataset.avviso = L && L.daFare.length ? '1' : '0';
}

/* ===================================================== 6. SHEET CALENDARIO */

/** Eventi che ha senso mettere in calendario (quelli non ancora passati). */
function eventiCalendario(tl) {
  if (!S.avvio) return [];
  const limite = Date.now() - 60000;
  return tl.eventi.filter((e) => S.avvio + e.min * 60000 >= limite);
}

function chiudiSheet() {
  $('#sheet-root').innerHTML = '';
  if (S.avvio && S.calendario.chiestoPerAvvio !== S.avvio) modifica((s) => { s.calendario.chiestoPerAvvio = s.avvio; });
}

function htmlSheetCalendario() {
  const { tl } = calcola();
  const eventi = eventiCalendario(tl);
  const conteggi = contaPerCategoria(eventi);
  const scelti = eventiSelezionati(eventi, S.calendario.categorie).length;
  const righe = Object.entries(CATEGORIE_CALENDARIO)
    .filter(([id]) => conteggi[id])
    .map(([id, c]) => `
      <div class="riga">
        <div class="riga__testo"><div class="riga__titolo">${c.nome} <small>(${conteggi[id]})</small></div></div>
        <button class="interruttore" role="switch" aria-checked="${!!S.calendario.categorie[id]}" aria-label="${c.nome}" data-azione="cal-cat" data-valore="${id}"></button>
      </div>`).join('');
  return `
    <div class="sheet__maniglia"></div>
    <h2 class="sheet__titolo" id="sheet-titolo">Li metto in calendario?</h2>
    <div class="sheet__elenco">${righe}</div>
    <div class="sheet__azioni">
      <button class="bottone bottone--lime" data-azione="cal-crea" ${scelti === 0 ? 'disabled' : ''}>${icona('cal')}Sì, crea ${scelti} promemoria</button>
      <button class="bottone bottone--contorno" data-azione="cal-no">No, solo la timeline</button>
    </div>`;
}

function apriSheetCalendario() {
  const sheet = $('#sheet-root .sheet');
  if (sheet) { sheet.innerHTML = htmlSheetCalendario(); return; }   // già aperto: aggiorna e basta
  $('#sheet-root').innerHTML = `
    <div class="velo" data-azione="cal-chiudi" role="presentation">
      <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-titolo">${htmlSheetCalendario()}</div>
    </div>`;
  $('#sheet-root .bottone')?.focus({ preventScroll: true });
}

/** Conferma a schermo (al posto di window.confirm, che alcuni ambienti bloccano). */
let rispostaConferma = null;
function chiedi({ titolo, testo, ok }) {
  return new Promise((risolvi) => {
    rispostaConferma = risolvi;
    $('#sheet-root').innerHTML = `
      <div class="velo" data-azione="conf-chiudi" role="presentation">
        <div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="conf-titolo">
          <div class="sheet__maniglia"></div>
          <h2 class="sheet__titolo" id="conf-titolo">${titolo}</h2>
          <p class="sheet__testo">${testo}</p>
          <div class="sheet__azioni">
            <button class="bottone" data-azione="conf-si">${ok}</button>
            <button class="bottone bottone--contorno" data-azione="conf-no">Annulla</button>
          </div>
        </div>
      </div>`;
    $('#sheet-root .bottone--contorno')?.focus({ preventScroll: true });
  });
}
function chiudiConferma(esito) {
  $('#sheet-root').innerHTML = '';
  rispostaConferma?.(esito);
  rispostaConferma = null;
}

async function creaCalendario() {
  const { tl } = calcola();
  const scelti = eventiSelezionati(eventiCalendario(tl), S.calendario.categorie);
  if (!scelti.length) return;
  const riepilogo = `${S.persone} persone · ${MODALITA[S.modo].nome}`;
  const ics = generaICS({ eventi: scelti, avvio: S.avvio, preavvisoMin: S.calendario.preavvisoMin, riepilogo });
  const nome = `spiEDO-${U.perDatetimeLocal(S.avvio).slice(0, 10)}.ics`;
  const esito = await consegnaICS(ics, nome);
  if (esito === 'annullato') return;
  chiudiSheet();
  toast(esito === 'condiviso' ? `Pronti ${scelti.length} promemoria. Scegli Calendario.` : `File scaricato: aprilo per aggiungere ${scelti.length} promemoria.`, { durata: 5000, icon: 'cal' });
}

/* ================================================= 7. AZIONI (CLICK) ==== */

function vai(nome) {
  if (!NOMI_VISTE.includes(nome)) nome = 'imposta';
  app.dataset.vista = nome;
  for (const v of NOMI_VISTE) {
    const tab = $(`#tab-${v}`);
    if (v === nome) tab.setAttribute('aria-current', 'page'); else tab.removeAttribute('aria-current');
  }
  try { history.replaceState(null, '', `#${nome}`); } catch (e) { /* ambienti senza history */ }
  window.scrollTo(0, 0);
  if (nome === 'cottura') { firmaCottura = ''; aggiornaLive(Date.now()); }
}

/** Dopo un cambio di stato si ridisegnano le viste: i calcoli sono leggeri. */
function disegna(quale) {
  const dati = calcola();
  const attivo = document.activeElement;
  const chiave = attivo?.dataset?.azione ? `[data-azione="${attivo.dataset.azione}"]${attivo.dataset.delta ? `[data-delta="${attivo.dataset.delta}"]` : ''}${attivo.dataset.valore ? `[data-valore="${attivo.dataset.valore}"]` : ''}${attivo.dataset.id ? `[data-id="${attivo.dataset.id}"]` : ''}` : null;

  if (!quale || quale === 'imposta') viste.imposta.innerHTML = htmlImposta(dati);
  if (!quale || quale === 'dosi') viste.dosi.innerHTML = htmlDosi(dati);
  if (!quale || quale === 'cottura') viste.cottura.innerHTML = htmlCottura(dati);
  $('#barra-riepilogo').textContent = `${S.persone} persone · ${MODALITA[S.modo].nome}`;

  if (chiave) {
    const el = $(chiave, viste[app.dataset.vista]);
    if (el && el !== attivo) el.focus({ preventScroll: true });
  }
}

function dopoModifica() {
  firmaCottura = '';
  disegna();
  aggiornaLive(Date.now());
  aggiornaWake();
}

/** Aggiorna solo i testi che dipendono dall'orario, senza ricostruire il campo data (importante su iOS). */
function aggiornaDerivatiPartenza() {
  const { tl } = calcola();
  $('#partenza-box').innerHTML = htmlPartenzaInfo(tl);
  $('#btn-conferma')?.classList.toggle('nascosto', !S.avvio);
  const serv = $('#in-servizio');
  if (serv && document.activeElement !== serv) serv.value = S.avvio ? U.perTime(oraServizio(S.avvio, tl.durata)) : '';
  firmaCottura = '';
  disegna('cottura');
  aggiornaWake();
}

const AZIONI = {
  vai: (el) => vai(el.dataset.vista),

  persone: (el) => {
    modifica((s) => { s.persone = U.limita(s.persone + Number(el.dataset.delta), GENERALI.persone.min, GENERALI.persone.max); });
    dopoModifica();
  },
  modo: (el) => {
    modifica((s) => { s.modo = el.dataset.valore; s.durataMin = null; });
    dopoModifica();
  },
  extra: (el) => {
    modifica((s) => { s.extra[el.dataset.valore] = !s.extra[el.dataset.valore]; });
    dopoModifica();
  },
  raspe: (el) => {
    modifica((s) => { s.spiedo.raspe = U.limita(s.spiedo.raspe + Number(el.dataset.delta), 1, 12); });
    dopoModifica();
  },
  lunghezza: (el) => {
    modifica((s) => { s.spiedo.lunghezzaCm = U.limita(s.spiedo.lunghezzaCm + Number(el.dataset.delta) * 5, 30, 150); });
    dopoModifica();
  },
  'modifica-dosi': () => { modificaDosiAttiva = !modificaDosiAttiva; disegna('dosi'); },
  aggiusta: (el) => {
    const id = el.dataset.id;
    const delta = Number(el.dataset.delta);
    const { dosi } = calcola();
    if (delta < 0 && (dosi.quantita[id] ?? 0) <= 0) return;   // non si scende sotto zero
    modifica((s) => {
      const valore = (s.aggiustamenti[id] ?? 0) + delta;
      if (valore === 0) delete s.aggiustamenti[id]; else s.aggiustamenti[id] = valore;
    });
    dopoModifica();
  },
  'aggiusta-reset': () => { modifica((s) => { s.aggiustamenti = {}; }); dopoModifica(); },
  'burro-ogni': (el) => {
    modifica((s) => { s.burroOgniMin = Number(el.dataset.valore); });
    dopoModifica();
  },
  durata: (el) => {
    modifica((s) => { s.durataMin = U.limita(durataCottura(s) + Number(el.dataset.delta), 60, 600); });
    dopoModifica();
  },
  'durata-reset': () => { modifica((s) => { s.durataMin = null; }); dopoModifica(); },
  preavviso: (el) => {
    modifica((s) => { s.calendario.preavvisoMin = Number(el.dataset.valore); });
    dopoModifica();
  },
  interruttore: (el) => {
    modifica((s) => { s[el.dataset.valore] = !s[el.dataset.valore]; });
    dopoModifica();
  },
  ripristina: async () => {
    const ok = await chiedi({ titolo: 'Ripristino tutto?', testo: 'Le impostazioni tornano a quelle di partenza e la cottura in corso viene azzerata.', ok: 'Sì, ripristina' });
    if (!ok) return;
    S = statoIniziale();
    salva(S);
    dopoModifica();
  },

  'parti-ora': () => {
    sbloccaAudio();
    modifica((s) => { s.avvio = Math.floor(Date.now() / 1000) * 1000; s.fatti = {}; s.calendario.chiestoPerAvvio = null; });
    dopoModifica();
    vai('cottura');
    apriSheetCalendario();
  },
  conferma: () => {
    sbloccaAudio();
    vai('cottura');
    if (S.calendario.chiestoPerAvvio !== S.avvio) apriSheetCalendario();
  },
  sposta: (el) => {
    modifica((s) => { s.avvio += Number(el.dataset.delta) * 60000; s.calendario.chiestoPerAvvio = null; });
    dopoModifica();
    toast(`Partenza spostata alle ${U.oraHM(S.avvio)}`, { icon: 'orologio' });
  },
  azzera: async () => {
    const ok = await chiedi({ titolo: 'Azzero la cottura?', testo: 'Perdi l\'orario di partenza e le azioni segnate come fatte. Le dosi restano.', ok: 'Sì, azzera' });
    if (!ok) return;
    modifica((s) => { s.avvio = null; s.fatti = {}; s.calendario.chiestoPerAvvio = null; });
    avvisati.clear();
    dopoModifica();
  },
  fatto: async (el) => {
    const id = el.dataset.id;
    const eraFatto = !!S.fatti[id];
    if (el.dataset.occupato) return;                 // doppio tocco durante l'animazione
    if (!eraFatto) {
      // Prima la spunta "salta", poi la card sparisce dall'elenco "da fare ora".
      if (!riduciMovimento()) {
        el.dataset.occupato = '1';
        el.setAttribute('aria-pressed', 'true');
        el.classList.add('cerchio--pop');
        await new Promise((ok) => setTimeout(ok, 380));
      }
      appenaFatto = id;
      setTimeout(() => { appenaFatto = null; }, 800);
    }
    modifica((s) => { if (s.fatti[id]) delete s.fatti[id]; else s.fatti[id] = Date.now(); });
    firmaCottura = '';
    aggiornaLive(Date.now());
  },

  calendario: () => apriSheetCalendario(),
  'cal-cat': (el) => {
    modifica((s) => { s.calendario.categorie[el.dataset.valore] = !s.calendario.categorie[el.dataset.valore]; });
    apriSheetCalendario();
  },
  'cal-crea': () => creaCalendario(),
  'cal-no': () => { chiudiSheet(); toast('Va bene: la timeline è qui sotto.', { icon: 'check' }); },
  'cal-chiudi': (el, evento) => { if (evento.target === el) chiudiSheet(); },
  'conf-si': () => chiudiConferma(true),
  'conf-no': () => chiudiConferma(false),
  'conf-chiudi': (el, evento) => { if (evento.target === el) chiudiConferma(false); },

  installa: async () => {
    if (!promptInstalla) return;
    promptInstalla.prompt();
    await promptInstalla.userChoice;
    promptInstalla = null;
    disegna('imposta');
  },
};

document.addEventListener('click', (evento) => {
  const el = evento.target.closest('[data-azione]');
  if (!el) return;
  const fn = AZIONI[el.dataset.azione];
  if (fn) fn(el, evento);
});

document.addEventListener('keydown', (evento) => {
  if (evento.key !== 'Escape' || !$('#sheet-root .velo')) return;
  if (rispostaConferma) chiudiConferma(false); else chiudiSheet();
});

/* campi di input: "change" scatta a modifica confermata */
document.addEventListener('change', (evento) => {
  const el = evento.target;
  if (el.id === 'in-persone') {
    const n = U.limita(Math.round(Number(el.value)) || GENERALI.persone.default, GENERALI.persone.min, GENERALI.persone.max);
    modifica((s) => { s.persone = n; });
    dopoModifica();
  } else if (el.id === 'in-avvio') {
    modifica((s) => { s.avvio = U.daDatetimeLocal(el.value); s.calendario.chiestoPerAvvio = null; });
    aggiornaDerivatiPartenza();
  } else if (el.id === 'in-servizio') {
    if (!el.value) return;
    const [h, m] = el.value.split(':').map(Number);
    const { tl } = calcola();
    const rif = S.avvio ? new Date(oraServizio(S.avvio, tl.durata)) : new Date();
    const servizio = new Date(rif);
    servizio.setHours(h, m, 0, 0);
    if (!S.avvio && servizio.getTime() <= Date.now()) servizio.setDate(servizio.getDate() + 1);
    modifica((s) => { s.avvio = avvioPerServire(servizio.getTime(), tl.durata); s.calendario.chiestoPerAvvio = null; });
    $('#in-avvio').value = U.perDatetimeLocal(S.avvio);
    aggiornaDerivatiPartenza();
  }
});

/* ====================================== 8. CICLO DI AGGIORNAMENTO E AVVIO */

const avvisati = new Set();   // eventi già annunciati in questa sessione

function controllaAllarmi(adesso) {
  if (!S.avvio) return;
  const { tl } = calcola();
  for (const e of tl.eventi) {
    const t = S.avvio + e.min * 60000;
    if (adesso < t) break;                     // gli eventi sono in ordine di tempo
    const chiave = `${S.avvio}:${e.id}`;
    if (avvisati.has(chiave)) continue;
    avvisati.add(chiave);
    if (adesso - t < 120000 && !S.fatti[e.id]) {   // solo se è "fresco": niente raffiche alla riapertura
      suona();
      toast(`<b>${titoloPiano(e)}</b>`, { allarme: true, durata: 9000, icon: 'orologio' });
    }
  }
}

function tick() {
  const adesso = Date.now();
  controllaAllarmi(adesso);
  aggiornaLive(adesso);
}

window.addEventListener('beforeinstallprompt', (evento) => {
  evento.preventDefault();
  promptInstalla = evento;
  disegna('imposta');
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { tick(); aggiornaWake(); }
});

function iniziale() {
  const richiesta = location.hash.replace('#', '');
  if (NOMI_VISTE.includes(richiesta)) return richiesta;
  if (S.avvio) {
    const { tl } = calcola();
    const adesso = Date.now();
    if (adesso > S.avvio - 90 * 60000 && adesso < S.avvio + (tl.durata + 60) * 60000) return 'cottura';
  }
  return 'imposta';
}

function avvia() {
  disegna();
  vai(iniziale());
  tick();
  setInterval(tick, 1000);
  setInterval(() => aggiornaWake(), 30000);
  aggiornaWake();

  // funzionamento offline e installazione (solo su http/https)
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* senza SW l'app funziona comunque */ });
  }
}

avvia();
