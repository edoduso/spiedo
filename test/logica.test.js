// Test della logica (dosi, timeline, calendario). Esegui con:  node --test test/
import test from 'node:test';
import assert from 'node:assert/strict';
import { statoIniziale } from '../js/stato.js';
import { calcolaDosi, costruisciTimeline, avvioPerServire, oraServizio, durataCottura, statoEvento } from '../js/calcoli.js';
import { generaICS, eventiSelezionati, contaPerCategoria } from '../js/calendario.js';
import { MODALITA, CM_PER_PRESA } from '../js/ricetta.js';

const mk = (o = {}) => ({ ...statoIniziale(), ...o });

const per = (d) => Object.fromEntries(d.righe.map((x) => [x.id, x.pezzi]));

test('dosi: a 15 persone sono quelle della nota (30 coppe, 10 lombi, 25 costine, 25 pollo, 3 kg di patate, 350 g di burro)', () => {
  const d = calcolaDosi(mk({ persone: 15 }));
  assert.deepEqual(per(d), { coppe: 30, lombi: 10, costine: 25, pollo: 25 });
  assert.equal(d.preseCarne, 90);
  assert.equal(d.patate.grammi, 3000);
  assert.equal(d.patate.pezzi, 30);
  assert.equal(d.prese, 120);
  assert.equal(d.burro.totale, 350);
  assert.equal(d.sale.totale, 190);   // appunti: 180-200 g
  assert.equal(d.sale.meta, 95);
  assert.equal(d.salviaFoglie, 90);   // una foglia per pezzo di carne, le patate non contano
});

test('lo spiedo di riferimento (6 raspe x 65 cm) con 15 persone è esattamente pieno', () => {
  const s = statoIniziale();
  assert.deepEqual(s.spiedo, { raspe: 6, lunghezzaCm: 65 });
  assert.equal(s.persone, 15);
  const d = calcolaDosi(s);
  assert.equal(CM_PER_PRESA, 3.25);
  assert.equal(d.capacita.presePerRaspa, 20);
  assert.equal(d.capacita.max, 120);
  assert.equal(d.capacita.percentuale, 100);
  assert.equal(d.capacita.ok, true);
  assert.equal(d.capacita.personeMax, 15);
});

test('dosi: con più o meno persone si scala in proporzione', () => {
  const doppio = calcolaDosi(mk({ persone: 30 }));
  assert.deepEqual(per(doppio), { coppe: 60, lombi: 20, costine: 50, pollo: 50 });
  assert.equal(doppio.patate.grammi, 6000);
  assert.equal(doppio.sale.totale, 380);
  assert.equal(doppio.burro.totale, 700);
  const dieci = calcolaDosi(mk({ persone: 10 }));
  assert.equal(dieci.patate.grammi, 2000);
  assert.equal(dieci.burro.totale, 230);   // 350 x 2/3 = 233, a multipli di 10
});

test('dosi: gli opzionali compaiono solo se attivi', () => {
  const d = calcolaDosi(mk({ persone: 15, extra: { uccellini: true, coniglio: true } }));
  assert.equal(d.righe.length, 6);
  assert.equal(d.preseCarne, 90 + 30 + 15);
});

test('capienza: dipende da raspe e lunghezza, patate comprese, e dice fino a quante persone regge', () => {
  const base = { persone: 20 };   // 159 prese con le patate
  assert.equal(calcolaDosi(mk({ ...base, spiedo: { raspe: 6, lunghezzaCm: 65 } })).capacita.ok, false);
  assert.equal(calcolaDosi(mk({ ...base, spiedo: { raspe: 8, lunghezzaCm: 65 } })).capacita.ok, true);
  assert.equal(calcolaDosi(mk({ ...base, spiedo: { raspe: 6, lunghezzaCm: 90 } })).capacita.ok, true);
  // spiedo più corto: meno persone
  const corto = calcolaDosi(mk({ persone: 15, spiedo: { raspe: 4, lunghezzaCm: 65 } }));
  assert.equal(corto.capacita.max, 80);
  assert.equal(corto.capacita.ok, false);
  assert.ok(corto.capacita.personeMax >= 9 && corto.capacita.personeMax <= 11);
  // personeMax è coerente: a quel numero ci sta, a uno in più no
  const m = corto.capacita.personeMax;
  assert.equal(calcolaDosi(mk({ persone: m, spiedo: { raspe: 4, lunghezzaCm: 65 } })).capacita.ok, true);
  assert.equal(calcolaDosi(mk({ persone: m + 1, spiedo: { raspe: 4, lunghezzaCm: 65 } })).capacita.ok, false);
});

test('dosi: scalano in modo monotono con le persone', () => {
  let prec = 0;
  for (let n = 1; n <= 80; n++) {
    const d = calcolaDosi(mk({ persone: n }));
    assert.ok(d.prese >= prec); prec = d.prese;
    assert.ok(d.burro.totale > 0 && d.sale.totale > 0 && d.patate.grammi > 0);
  }
});

for (const modo of Object.keys(MODALITA)) {
  test(`timeline ${modo}: ordine, id univoci, eventi dentro la cottura`, () => {
    const tl = costruisciTimeline(mk({ modo }));
    const ids = new Set(tl.eventi.map((e) => e.id));
    assert.equal(ids.size, tl.eventi.length, 'id duplicati');
    for (let i = 1; i < tl.eventi.length; i++) assert.ok(tl.eventi[i].min >= tl.eventi[i - 1].min);
    assert.ok(tl.eventi.every((e) => e.min >= 0 && e.min <= tl.durata), 'evento fuori dalla cottura');
    assert.equal(tl.eventi.at(-1).chiave, 'fine');
    assert.equal(tl.eventi.at(-1).min, tl.durata);
    // il profilo copre tutta la cottura senza buchi
    assert.equal(tl.profilo[0].da, 0);
    assert.equal(tl.profilo.at(-1).a, tl.durata);
    for (let i = 1; i < tl.profilo.length; i++) assert.equal(tl.profilo[i].da, tl.profilo[i - 1].a);
    // nessun segnaposto rimasto
    assert.ok(tl.eventi.every((e) => !/\{\w+\}/.test(e.testo)), 'segnaposto non risolto');
  });

  test(`programma ${modo}: solo i sei passi richiesti`, () => {
    const titoli = new Set(costruisciTimeline(mk({ modo })).eventi.map((e) => e.titolo));
    assert.deepEqual([...titoli].sort(), [
      'Alza la temperatura', 'Prima salatura', 'Prima untata', 'Seconda salatura', 'Tira giù lo spiedo', 'Unta di nuovo',
    ]);
  });
}

test('durate: elettrico 4 h 30, brace più lunga dell\'elettrico, fuoco più lungo della brace', () => {
  const d = (m) => MODALITA[m].durataMin;
  assert.equal(d('elettrico'), 270);
  assert.ok(d('brace') > d('elettrico'));
  assert.ok(d('fuoco') > d('brace'));
});

test('timeline elettrico: tempi degli appunti', () => {
  const tl = costruisciTimeline(mk({ modo: 'elettrico' }));
  const un = (k) => tl.eventi.find((e) => e.chiave === k);
  assert.equal(tl.durata, 270);
  assert.equal(un('burro1').titolo, 'Prima untata');
  assert.equal(un('sale1').min, 120, 'prima salatura dopo 2 ore');
  assert.equal(un('sale2').min, 240, 'seconda salatura mezz\'ora prima di tirare giù');
  assert.equal(un('alza1').min, 60, '220 °C dopo la prima ora');
  assert.equal(un('alza2').min, 180, 'massimo dopo 3 ore');
  assert.deepEqual(tl.profilo.map((f) => f.temp), ['180 °C', '220 °C', 'Massimo']);
  assert.deepEqual(tl.profilo.map((f) => [f.da, f.a]), [[0, 60], [60, 180], [180, 270]]);
});

test('timeline brace e fuoco: stessa ricetta stirata, seconda salatura sempre mezz\'ora prima della fine', () => {
  for (const modo of ['brace', 'fuoco']) {
    const tl = costruisciTimeline(mk({ modo }));
    const un = (k) => tl.eventi.find((e) => e.chiave === k);
    assert.equal(un('sale2').min, tl.durata - 30);
    assert.ok(un('sale1').min > 120, `${modo}: la prima salatura slitta`);
    assert.ok(un('alza2').min > 180);
    assert.deepEqual(tl.profilo.map((f) => f.nome), ['Prima fase', 'Fase centrale', 'Fase finale']);
  }
});

test('burro: mai nei 15 minuti prima delle salature né nei 10 dopo, mai negli ultimi 15', () => {
  for (const modo of Object.keys(MODALITA)) {
    for (const ogni of [15, 20, 30, 45]) {
      const tl = costruisciTimeline(mk({ modo, burroOgniMin: ogni }));
      const s1 = tl.eventi.find((e) => e.chiave === 'sale1').min;
      const s2 = tl.eventi.find((e) => e.chiave === 'sale2').min;
      for (const e of tl.eventi.filter((x) => x.chiave === 'ripassa')) {
        const msg = `${modo}, ogni ${ogni}: burro a ${e.min}`;
        assert.ok(!(e.min >= s1 - 15 && e.min <= s1 + 10), `${msg} attorno alla 1ª salatura`);
        assert.ok(!(e.min >= s2 - 15 && e.min <= s2 + 10), `${msg} attorno alla 2ª salatura`);
        assert.ok(e.min <= tl.durata - 20, `${msg} troppo vicino alla fine`);
      }
    }
  }
});

test('non ci sono più passi di vecchie ricette', () => {
  const chiavi = new Set(Object.values(MODALITA).flatMap((m) => m.azioni.map((a) => a.chiave)));
  for (const k of ['via', 'rabbocco', 'assaggio', 'schiumetta', 'sale', 'asciuga', 'asciuga1', 'asciuga2', 'scalda-sale',
    'stop-burro', 'bianco', 'termostato', 'accendi', 'braci', 'legna', 'temp-220', 'temp-max']) assert.ok(!chiavi.has(k), k);
});

test('burro ogni 45: meno eventi', () => {
  const a = costruisciTimeline(mk({ burroOgniMin: 20 })).eventi.filter((e) => e.chiave === 'ripassa').length;
  const b = costruisciTimeline(mk({ burroOgniMin: 45 })).eventi.filter((e) => e.chiave === 'ripassa').length;
  assert.ok(b < a);
});

test('durata personalizzata sposta la seconda salatura e la fine', () => {
  const tl = costruisciTimeline(mk({ modo: 'elettrico', durataMin: 300 }));
  assert.equal(tl.eventi.find((e) => e.chiave === 'sale2').min, 270);
  assert.equal(tl.eventi.at(-1).min, 300);
});

test('orario di servizio e partenza sono inversi', () => {
  const s = mk({ modo: 'elettrico' });
  const d = durataCottura(s);
  const serv = new Date('2026-10-11T13:00:00').getTime();
  const avvio = avvioPerServire(serv, d);
  assert.equal(oraServizio(avvio, d), serv);
  assert.equal(new Date(avvio).getHours(), 8);   // 13:00 - 4h30 - 15' = 08:15
  assert.equal(new Date(avvio).getMinutes(), 15);
});

test('stato evento: futuro / ora / passato', () => {
  const tl = costruisciTimeline(mk());
  const ev = tl.eventi.find((e) => e.chiave === 'sale1');
  const avvio = 1_000_000_000_000;
  const t = avvio + ev.min * 60000;
  assert.equal(statoEvento(ev, avvio, t - 1000, {}), 'futuro');
  assert.equal(statoEvento(ev, avvio, t + 1000, {}), 'ora');
  assert.equal(statoEvento(ev, avvio, t + 1000, { [ev.id]: 1 }), 'passato');
  assert.equal(statoEvento(ev, avvio, t + 11 * 60000, {}), 'passato');
});

test('ICS: struttura valida, righe <= 75 byte, categorie rispettate', () => {
  const s = mk();
  const tl = costruisciTimeline(s);
  const sel = eventiSelezionati(tl.eventi, { principali: true, burro: false });
  const avvio = new Date('2026-10-11T07:30:00').getTime();
  const ics = generaICS({ eventi: sel, avvio, preavvisoMin: 5, riepilogo: '12 persone · Brace' });
  assert.ok(ics.startsWith('BEGIN:VCALENDAR'));
  assert.ok(ics.trimEnd().endsWith('END:VCALENDAR'));
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, sel.length);
  assert.equal((ics.match(/END:VEVENT/g) || []).length, sel.length);
  assert.equal((ics.match(/TRIGGER:-PT5M/g) || []).length, sel.length);
  for (const riga of ics.split('\r\n')) assert.ok(new TextEncoder().encode(riga).length <= 75, riga);
  const c = contaPerCategoria(tl.eventi);
  assert.ok(c.principali > 0 && c.burro > 0);
});

test('calendario: assaggi e braci non vengono mai esportati', () => {
  const tl = costruisciTimeline(mk());
  const sel = eventiSelezionati(tl.eventi, mk().calendario.categorie);
  assert.ok(sel.length > 0);
  assert.ok(sel.every((e) => e.cat === 'principali' || e.cat === 'burro'));
});

test('stato: i campi liberi (fatti) sopravvivono al merge', async () => {
  const { carica, salva } = await import('../js/stato.js');
  const s = carica(); s.fatti = { 'sale1@120': 123 }; s.persone = 20; salva(s);
  const r = carica();
  assert.equal(r.fatti['sale1@120'], 123);
  assert.equal(r.persone, 20);
});

test('correzioni manuali: si aggiunge e si toglie, mai sotto zero', () => {
  const base = calcolaDosi(mk());
  const d = calcolaDosi(mk({ aggiustamenti: { pollo: 2, burro: -1, sale: 1, salvia: 1 } }));
  assert.equal(d.quantita.pollo, base.quantita.pollo + 2);
  assert.equal(d.burro.totale, base.burro.totale - 50);
  assert.equal(d.sale.totale, base.sale.totale + 5);
  // La salvia si verifica da sola: cambiando i pezzi cambia anche la quantità calcolata.
  assert.equal(calcolaDosi(mk({ aggiustamenti: { salvia: 1 } })).salviaFoglie, base.salviaFoglie + 5);
  assert.equal(d.prese, base.prese + 2);                 // le prese seguono i pezzi
  assert.equal(calcolaDosi(mk({ aggiustamenti: { patate: 2 } })).patate.grammi, base.patate.grammi + 500);
  assert.equal(d.correzioni.pollo, 2);
  assert.equal(calcolaDosi(mk({ aggiustamenti: { costine: -1000 } })).quantita.costine, 0);
});

test('le correzioni arrivano ai testi della timeline', () => {
  const a = costruisciTimeline(mk()).eventi.find((e) => e.chiave === 'sale1').testo;
  const b = costruisciTimeline(mk({ aggiustamenti: { sale: 10 } })).eventi.find((e) => e.chiave === 'sale1').testo;
  assert.notEqual(a, b);
});

/* ---------------------------------------------------------------- PACCHETTO -- */
// Controlli sui file dell'app (anteprima di condivisione, cache offline, pubblicazione).
import { readFileSync, existsSync } from 'node:fs';
const leggi = (percorso) => readFileSync(new URL(`../${percorso}`, import.meta.url), 'utf8');

test('anteprima di condivisione: meta og completi e immagine 1200x630', () => {
  const html = leggi('index.html');
  for (const k of ['og:title', 'og:description', 'og:image', 'og:url', 'twitter:card']) assert.ok(html.includes(k), k);
  assert.ok(html.includes('content="__BASE_URL__icons/og.png"'), 'og:image deve usare il segnaposto assoluto');
  const png = readFileSync(new URL('../icons/og.png', import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
});

test('pubblicazione: il workflow sostituisce __BASE_URL__ e lancia i test', () => {
  const wf = leggi('.github/workflows/pubblica.yml');
  assert.ok(wf.includes('__BASE_URL__'));
  assert.ok(wf.includes('npm test'));
  assert.ok(existsSync(new URL('../LICENSE', import.meta.url)));
  assert.ok(existsSync(new URL('../.gitignore', import.meta.url)));
});

test('service worker: tutti i file in cache esistono davvero (niente 404 offline)', () => {
  const sw = leggi('sw.js');
  const elenco = sw.match(/FILE_BASE = \[([\s\S]*?)\];/)[1];
  const file = [...elenco.matchAll(/'\.\/([^']*)'/g)].map((m) => m[1]).filter(Boolean);
  assert.ok(file.length > 10);
  for (const f of file) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), `manca ${f}`);
});

test('niente font inutilizzati: ogni @font-face punta a un file presente', () => {
  const css = leggi('css/style.css');
  const usati = [...css.matchAll(/url\('\.\.\/(fonts\/[^']+)'\)/g)].map((m) => m[1]);
  assert.equal(usati.length, 2, 'archivo-black e dm-sans');
  for (const f of usati) assert.ok(existsSync(new URL(`../${f}`, import.meta.url)), f);
  assert.ok(!existsSync(new URL('../fonts/caveat.woff2', import.meta.url)));
});
