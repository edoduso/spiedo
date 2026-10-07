/**
 * STATO  ·  tutto ciò che l'app ricorda tra una visita e l'altra.
 * Salvato nel localStorage del telefono: nessun server, nessun account.
 * Se il localStorage non è disponibile (anteprima, navigazione privata)
 * l'app funziona lo stesso, tenendo i dati solo in memoria.
 */
import { GENERALI, CATEGORIE_CALENDARIO } from './ricetta.js';

const CHIAVE = 'spiedo.stato.v1';
let inMemoria = null;

/** Valori iniziali. Ogni campo è spiegato qui, in un solo posto. */
export function statoIniziale() {
  const categorie = {};
  for (const [id, c] of Object.entries(CATEGORIE_CALENDARIO)) categorie[id] = c.predefinita;
  return {
    persone: GENERALI.persone.default,
    modo: 'brace',                           // brace | fuoco | elettrico
    extra: { uccellini: false, coniglio: false },
    spiedo: { ...GENERALI.riferimento.spiedo },   // raspe (aste) e lunghezza di ciascuna
    durataMin: null,                         // null = durata standard della modalità
    burroOgniMin: GENERALI.burroOgniDefault,
    avvio: null,                             // timestamp (ms) in cui lo spiedo inizia a girare
    fatti: {},                               // { idEvento: timestamp } azioni segnate come fatte
    calendario: {
      categorie,                             // quali gruppi di promemoria creare
      preavvisoMin: GENERALI.preavvisoDefault,
      chiestoPerAvvio: null,                 // avvio per cui è già comparsa la domanda
    },
    aggiustamenti: {},                       // correzioni manuali alle dosi: { idIngrediente: numero di passi }
    schermoAcceso: true,                     // tiene lo schermo acceso durante la cottura
    suoni: true,                             // suono e vibrazione quando scatta un promemoria
  };
}

/** Unisce in profondità i dati salvati con i default (così i campi nuovi non rompono nulla). */
function unisci(base, salvato) {
  if (!salvato || typeof salvato !== 'object') return base;
  // Oggetto "libero" (es. fatti): si prende così com'è.
  if (Object.keys(base).length === 0) return salvato;
  const out = { ...base };
  for (const k of Object.keys(base)) {
    const b = base[k];
    const s = salvato[k];
    if (s === undefined) continue;
    out[k] = b && typeof b === 'object' && !Array.isArray(b) ? unisci(b, s) : s;
  }
  return out;
}

export function carica() {
  const base = statoIniziale();
  try {
    const grezzo = localStorage.getItem(CHIAVE);
    if (grezzo) return unisci(base, JSON.parse(grezzo));
  } catch (e) { /* localStorage non disponibile */ }
  return inMemoria ? unisci(base, inMemoria) : base;
}

export function salva(stato) {
  inMemoria = JSON.parse(JSON.stringify(stato));
  try {
    localStorage.setItem(CHIAVE, JSON.stringify(stato));
  } catch (e) { /* si va avanti in memoria */ }
}
