/**
 * CALCOLI  ·  dosi e timeline. Nessuna dipendenza dal DOM.
 *
 *   calcolaDosi(stato)        -> quantità per il numero di persone scelto
 *   costruisciTimeline(stato) -> elenco di eventi con il minuto in cui accadono
 *   fasePerMinuto(...)        -> in quale fase di cottura ci si trova
 *
 * Le regole (dosi per persona, tempi, testi) NON stanno qui: stanno in ricetta.js.
 */
import { INGREDIENTI, MODALITA, GENERALI, PASSI_AGGIUSTAMENTO, CM_PER_PRESA } from './ricetta.js';
import { arrotondaSu, arrotonda, grammi, numIt } from './utils.js';

/* ------------------------------------------------------------------ DOSI -- */

/** Correzione manuale (tasti + e - nella schermata Dosi) di un ingrediente, in unità reali. */
const correzioneDi = (stato, id) => (stato.aggiustamenti?.[id] ?? 0) * (PASSI_AGGIUSTAMENTO[id] ?? 1);
const conCorrezione = (stato, id, calcolato) => Math.max(0, calcolato + correzioneDi(stato, id));

/** Carni e patate per `n` persone. Le dosi della nota valgono per `riferimento.persone`: si scala in proporzione. */
function ingredientiPer(stato, n) {
  const fattore = n / GENERALI.riferimento.persone;

  const righe = [];
  for (const c of INGREDIENTI.carni) {
    if (c.opzionale && !stato.extra[c.id]) continue;
    const calcolati = c.pezziBase
      ? Math.max(1, Math.round(c.pezziBase * fattore))   // carni della nota
      : Math.ceil(c.perPersona * n - 1e-9);              // carni opzionali: a testa
    const pezzi = conCorrezione(stato, c.id, calcolati);
    let capo = null;
    if (c.capo) {
      const q = Math.ceil((pezzi / c.capo.pezzi) * 2 - 1e-9) / 2; // al mezzo capo
      capo = `circa ${numIt(q, 1)} ${c.capo.nome}`;
    }
    righe.push({ id: c.id, nome: c.nome, unita: c.unita, pezzi, grammi: pezzi * c.grammiPezzo, capo, opzionale: !!c.opzionale });
  }

  const pt = INGREDIENTI.patate;
  const patateG = conCorrezione(stato, pt.id, Math.max(50, arrotonda(pt.gPerPersona * n, 50)));
  const patate = { grammi: patateG, pezzi: Math.ceil(patateG / pt.gPerPezzo - 1e-9) };

  const preseCarne = righe.reduce((somma, r) => somma + r.pezzi, 0);
  return { righe, patate, preseCarne, prese: preseCarne + patate.pezzi };
}

export function calcolaDosi(stato) {
  const n = stato.persone;
  const base = GENERALI.riferimento;
  const fattore = n / base.persone;
  const { righe, patate, preseCarne, prese } = ingredientiPer(stato, n);
  const pesoCarneG = righe.reduce((somma, r) => somma + r.grammi, 0);

  const sv = INGREDIENTI.salvia;
  const salviaFoglie = conCorrezione(stato, 'salvia', arrotondaSu(preseCarne * sv.fogliePerPresa, sv.arrotondaA));

  const burro = { totale: conCorrezione(stato, 'burro', Math.max(10, arrotonda(base.burroG * fattore, 10))) };

  // Il sale si divide in due salature uguali.
  const saleTotale = conCorrezione(stato, 'sale', Math.max(5, arrotonda(base.saleG * fattore, 5)));
  const sale = { totale: saleTotale, meta: arrotonda(saleTotale / 2, 5) };

  // Quante prese ci stanno: lunghezza della raspa divisa per lo spazio di una presa (carne e patate insieme).
  const { raspe, lunghezzaCm } = stato.spiedo;
  const presePerRaspa = Math.floor(lunghezzaCm / CM_PER_PRESA + 1e-9);
  const max = raspe * presePerRaspa;

  // Fino a quante persone regge questo spiedo, con gli stessi extra e le stesse correzioni.
  let personeMax = 0;
  for (let k = 1; k <= GENERALI.persone.max; k++) {
    if (ingredientiPer(stato, k).prese <= max) personeMax = k; else break;
  }

  const capacita = {
    prese,
    max,
    raspe,
    lunghezzaCm,
    presePerRaspa,
    personeMax,
    percentuale: max > 0 ? Math.round((prese / max) * 100) : 999,
    perRaspa: Math.ceil(prese / Math.max(1, raspe)),
    ok: prese <= max,
  };

  // Quantità finali (con le correzioni) e correzioni in unità reali, indicizzate per id.
  const quantita = { salvia: salviaFoglie, burro: burro.totale, sale: sale.totale, patate: patate.grammi };
  for (const r of righe) quantita[r.id] = r.pezzi;
  const correzioni = {};
  for (const id of Object.keys(quantita)) correzioni[id] = correzioneDi(stato, id);

  return { persone: n, righe, patate, prese, preseCarne, pesoCarneG, salviaFoglie, burro, sale, capacita, quantita, correzioni };
}

/** Segnaposto {…} usati nei testi della ricetta. */
export function segnaposto(dosi) {
  return {
    burro: grammi(dosi.burro.totale),
    saleTotale: grammi(dosi.sale.totale),
    saleMeta: grammi(dosi.sale.meta),
  };
}

function riempi(testo, mappa) {
  return testo.replace(/\{(\w+)\}/g, (_, k) => (k in mappa ? mappa[k] : `{${k}}`));
}

/* -------------------------------------------------------------- TIMELINE -- */

export function durataCottura(stato) {
  return stato.durataMin ?? MODALITA[stato.modo].durataMin;
}

/** Trasforma { inizio | fine | frazione } in minuti dalla partenza. */
function risolvi(q, durata) {
  if ('inizio' in q) return q.inizio;
  if ('fine' in q) return durata - q.fine;
  if ('frazione' in q) return Math.round((durata * q.frazione) / 5) * 5;
  throw new Error(`Tempo non valido nella ricetta: ${JSON.stringify(q)}`);
}

export function costruisciTimeline(stato) {
  const modo = MODALITA[stato.modo];
  const durata = durataCottura(stato);
  const ph = segnaposto(calcolaDosi(stato));
  const eventi = [];

  modo.azioni.forEach((a, ordine) => {
    const base = {
      chiave: a.chiave,
      cat: a.cat,
      tag: a.tag,
      titolo: a.titolo,
      testo: riempi(a.testo, ph),
      durataMin: a.durataMin ?? 5,
      graceMin: a.graceMin ?? 10,
      ordine,
    };
    if (a.ripeti) {
      const da = risolvi(a.ripeti.da, durata);
      const a2 = risolvi(a.ripeti.a, durata);
      const ogni = a.ripeti.ogni === 'burro' ? stato.burroOgniMin : a.ripeti.ogni;
      // Finestre in cui l'azione si salta (es. niente burro attorno alle salature).
      const finestre = (a.ripeti.salta ?? []).map((f) => {
        const centro = risolvi(f.attorno, durata);
        return [centro - f.prima, centro + f.dopo];
      });
      const gruppo = [];
      for (let t = da; t <= a2; t += ogni) {
        if (!finestre.some(([inizio, fine]) => t >= inizio && t <= fine)) gruppo.push(t);
      }
      gruppo.forEach((min, i) => eventi.push({ ...base, min, numero: i + 1, totale: gruppo.length }));
    } else {
      eventi.push({ ...base, min: risolvi(a.quando, durata), numero: 1, totale: 1 });
    }
  });

  eventi.sort((x, y) => x.min - y.min || x.ordine - y.ordine);
  eventi.forEach((e) => { e.id = `${e.chiave}@${e.min}`; });

  const profilo = modo.profilo.map((p) => ({
    nome: p.nome,
    temp: p.temp,
    nota: p.nota ?? null,
    da: risolvi(p.da, durata),
    a: risolvi(p.a, durata),
  }));

  return { durata, eventi, profilo, modo };
}

/** Fase in cui ci si trova al minuto dato (null se prima o dopo la cottura). */
export function fasePerMinuto(profilo, min) {
  return profilo.find((p) => min >= p.da && min < p.a) ?? null;
}

/**
 * Stato di un evento rispetto a "adesso":
 *   'futuro'   deve ancora accadere
 *   'ora'      è scaduto da poco e non è stato segnato come fatto
 *   'passato'  è scaduto (e segnato o troppo vecchio per essere "da fare")
 */
export function statoEvento(ev, avvio, adesso, fatti) {
  const t = avvio + ev.min * 60000;
  if (adesso < t) return 'futuro';
  if (fatti[ev.id]) return 'passato';
  return adesso - t < ev.graceMin * 60000 ? 'ora' : 'passato';
}

/** Ora di servizio prevista (timestamp) per una partenza data. */
export function oraServizio(avvio, durata) {
  return avvio + (durata + GENERALI.servizioDopoMin) * 60000;
}

/** Partenza necessaria per servire a una certa ora. */
export function avvioPerServire(servizio, durata) {
  return servizio - (durata + GENERALI.servizioDopoMin) * 60000;
}
