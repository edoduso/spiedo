/**
 * ============================================================================
 *  RICETTA  ·  spiedo alla bresciana (Valle Sabbia)
 * ============================================================================
 *  QUESTO È IL FILE DA MODIFICARE per cambiare la ricetta.
 *  Nessun'altra parte dell'app contiene dosi, tempi o testi di cottura.
 *
 *  Come è organizzato:
 *    1. IMPOSTAZIONI GENERALI   persone, dosi di riferimento, orari
 *    2. INGREDIENTI             pezzi di riferimento (scalano con le persone)
 *    3. MODALITÀ DI COTTURA     brace / fuoco / elettrico, con tempi e azioni
 *    4. TAG E CATEGORIE         colori delle etichette e raggruppamenti calendario
 *
 *  Tutti i tempi sono in MINUTI dal momento in cui lo spiedo inizia a girare
 *  ("minuto 0"). Per le azioni prima della partenza si usano numeri negativi.
 *
 *  RIFERIMENTO: gli appunti di Edo (nota del 1 settembre 2023 + foglio scritto
 *  a mano). Sono la fonte unica per dosi, tempi, temperature e salature.
 *  Dove gli appunti tacciono, il punto è segnato con "ASSUNZIONE": da correggere.
 * ============================================================================
 */

/* ----------------------------------------------------------------------------
 * 1. IMPOSTAZIONI GENERALI
 * -------------------------------------------------------------------------- */
export const GENERALI = {
  nome: 'Spiedo alla bresciana',
  edizione: 'Valle Sabbia',

  persone: { min: 1, max: 80, default: 15 },

  /**
   * LO SPIEDO DI RIFERIMENTO: quello su cui sono state calcolate le dosi della nota.
   * 15 persone, 6 raspe da 65 cm, 3,5 etti di burro, 180-200 g di sale, 3 kg di patate.
   * Con più o meno persone l'app scala tutto in proporzione; con un altro spiedo
   * (raspe e lunghezza diverse) controlla quante persone ci stanno.
   *   persone   per quante persone valgono le dosi di base
   *   spiedo    raspe (le aste) e lunghezza dello spiedo di riferimento (anche il valore di partenza dell'app)
   *   burroG    burro totale (3,5 etti)
   *   saleG     sale totale: gli appunti dicono 180-200 g, qui il valore di mezzo. Si divide in due salature
   */
  riferimento: {
    persone: 15,
    spiedo: { raspe: 6, lunghezzaCm: 65 },
    burroG: 350,
    saleG: 190,
  },

  /** Minuti tra "spiedo pronto" e "si mangia" (smontare, sfilare, impiattare). */
  servizioDopoMin: 15,

  /** Scelte disponibili nelle impostazioni avanzate. */
  burroOgniOpzioni: [15, 20, 30, 45],
  burroOgniDefault: 20,
  preavvisoOpzioni: [0, 5, 10],
  preavvisoDefault: 0,
};

/* ----------------------------------------------------------------------------
 * 2. INGREDIENTI
 * ----------------------------------------------------------------------------
 *  pezziBase    pezzi della nota, per le persone di `GENERALI.riferimento`.
 *               L'app li scala in proporzione al numero di persone.
 *  perPersona   per le carni opzionali, che non sono nella nota: pezzi a testa
 *  grammiPezzo  peso a crudo di un pezzo. ASSUNZIONE: stime, non sono nei tuoi appunti.
 *  capo         conversione utile per la spesa: quanti pezzi esce da un capo
 *  opzionale    true = compare solo se attivato nelle impostazioni
 * -------------------------------------------------------------------------- */
export const INGREDIENTI = {
  carni: [
    { id: 'coppe', nome: 'Coppe', pezziBase: 30, grammiPezzo: 50, unita: 'pezzi' },
    { id: 'lombi', nome: 'Lombi', pezziBase: 10, grammiPezzo: 80, unita: 'pezzi' },
    { id: 'costine', nome: 'Costine', pezziBase: 25, grammiPezzo: 90, unita: 'pezzi' },
    {
      id: 'pollo',
      nome: 'Pollo',
      pezziBase: 25,
      grammiPezzo: 75,
      unita: 'pezzi',
      capo: { pezzi: 3, nome: 'sovracosce' },
    },
    {
      id: 'uccellini',
      nome: 'Uccellini',
      perPersona: 2,
      grammiPezzo: 30,
      unita: 'uccellini',
      opzionale: true,
    },
    {
      id: 'coniglio',
      nome: 'Coniglio',
      perPersona: 1,
      grammiPezzo: 75,
      unita: 'pezzi',
      capo: { pezzi: 10, nome: 'conigli' },
      opzionale: true,
    },
  ],

  /** Salvia: una foglia per ogni pezzo di carne (non è negli appunti: ASSUNZIONE). */
  salvia: { fogliePerPresa: 1, arrotondaA: 5 },

  /**
   * Patate, infilate sullo spiedo insieme alla carne: 3 kg per 15 persone (appunti), cioè 200 g a testa.
   * gPerPezzo: ASSUNZIONE, una patata media tagliata. Serve a contare quanto posto occupano sulle raspe.
   */
  patate: { id: 'patate', nome: 'Patate', gPerPersona: 200, gPerPezzo: 100 },
};

/**
 * Spazio occupato da una presa sulla raspa, in cm, foglia di salvia compresa.
 * Non è un numero scelto a caso: si ricava dal tuo spiedo di riferimento, che era pieno
 * (6 raspe x 65 cm per 90 pezzi di carne + 3 kg di patate = 120 prese, quindi 3,25 cm a presa).
 */
export const CM_PER_PRESA = (() => {
  const { spiedo, persone } = GENERALI.riferimento;
  const carne = INGREDIENTI.carni.filter((c) => !c.opzionale).reduce((tot, c) => tot + c.pezziBase, 0);
  const patate = Math.ceil((INGREDIENTI.patate.gPerPersona * persone) / INGREDIENTI.patate.gPerPezzo);
  return (spiedo.raspe * spiedo.lunghezzaCm) / (carne + patate);
})();

/** Di quanto cambia una quantità a ogni tocco di + o - nella schermata Dosi. */
export const PASSI_AGGIUSTAMENTO = {
  coppe: 1,
  lombi: 1,
  costine: 1,
  pollo: 1,
  uccellini: 1,
  coniglio: 1,
  salvia: 5,   // foglie
  burro: 50,   // grammi
  patate: 250, // grammi
  sale: 5,     // grammi
};

/* ----------------------------------------------------------------------------
 * 3. MODALITÀ DI COTTURA
 * ----------------------------------------------------------------------------
 *  Ogni azione ha:
 *    chiave     identificatore (non cambiarlo dopo, serve per i "fatto")
 *    quando     { inizio: N }  N minuti dalla partenza (anche negativo)
 *               { fine: N }    N minuti prima della fine cottura
 *               { frazione: X } X della durata totale (0.5 = metà cottura)
 *    ripeti     { da: <quando>, a: <quando>, ogni: minuti | 'burro', salta: [...] }
 *               salta: finestre senza eventi, { attorno: <quando>, prima: N, dopo: N }
 *    cat        categoria per il calendario (vedi CATEGORIE_CALENDARIO)
 *    tag        etichetta colorata (vedi TAG)
 *    titolo     titolo breve
 *    testo      istruzione (finisce nelle note del calendario).
 *               Segnaposto: {burro} {saleTotale} {saleMeta}
 *    durataMin  durata dell'evento in calendario (default 5)
 *    graceMin   per quanti minuti resta "da fare ora" (default 10)
 * -------------------------------------------------------------------------- */

/** Durata dei tuoi appunti, per l'elettrico: 1 h a 180 °C + 2 h a 220 °C + 1 h 30 al massimo. */
const DURATA_ELETTRICO_MIN = 270;

/**
 * Brace e fuoco ci mettono più dell'elettrico, e il fuoco più della brace.
 * ASSUNZIONE: 5 ore e 6 ore (le fonti trovate in rete dicono 4-6 h). La ricetta degli appunti si
 * allunga in proporzione: fasi, primo burro e prima salatura.
 */
const DURATA_BRACE_MIN = 300;
const DURATA_FUOCO_MIN = 360;

/**
 * Orari "dal via" della ricetta per una certa durata. Per l'elettrico sono quelli degli appunti
 * (60 / 120 / 180 minuti); per le altre modalità si stirano in proporzione, a multipli di 5.
 * Quello che si conta "dalla fine" (seconda salatura, pausa del burro) non cambia.
 */
function tempi(durataMin) {
  const k = durataMin / DURATA_ELETTRICO_MIN;
  const s = (minuti) => Math.round((minuti * k) / 5) * 5;
  return {
    durataMin,
    primaFase: s(60),      // fine della prima fase (negli appunti: 1ª ora a 180 °C)
    ultimaFase: s(180),    // inizio dell'ultima fase (appunti: dopo 3 ore)
    salatura1: s(120),     // prima salatura (appunti: dopo 2 ore circa)
    primoBurro: s(30),     // ASSUNZIONE: gli appunti non lo dicono
    primoRipasso: s(50),
  };
}

/** Seconda salatura: mezz'ora prima di tirare giù. */
const SALATURA_2 = { fine: 30 };

/** Il burro si ferma 10-15 minuti prima di ogni salatura (qui il massimo) per lasciar asciugare... */
const ASCIUGA_PRIMA_MIN = 15;

/** ...e "non si unta subito dopo". ASSUNZIONE: 10 minuti senza burro. */
const SENZA_BURRO_DOPO_MIN = 10;

/** Si smette di ungere 15 minuti prima di tirare giù. */
const STOP_BURRO_FINE_MIN = 15;

/**
 * IL PROGRAMMA: sono solo questi sei passi, in tutte le modalità.
 *   Prima untata · Unta di nuovo · Prima salatura · Seconda salatura · Alza la temperatura · Tira giù lo spiedo
 * Pause del burro (le "finestre senza burro" di `salta`) e fasi restano nel calcolo,
 * ma non hanno un passo a parte.
 *
 *   t         gli orari della ricetta (vedi tempi)
 *   alza      i passi "Alza la temperatura" della modalità (cambiano tra elettrico, brace e fuoco)
 */
function programma({ t, alza }) {
  const salatura1 = { inizio: t.salatura1 };
  return [
    {
      chiave: 'burro1',
      quando: { inizio: t.primoBurro },
      cat: 'principali',
      tag: 'burro',
      titolo: 'Prima untata',
      testo: 'Metti {burro} di burro a pezzi sulla leccarda. Sciogliendosi cola su tutto lo spiedo.',
    },
    {
      chiave: 'ripassa',
      ripeti: {
        da: { inizio: t.primoRipasso },
        a: { fine: STOP_BURRO_FINE_MIN + 5 },
        ogni: 'burro',
        salta: [
          { attorno: salatura1, prima: ASCIUGA_PRIMA_MIN, dopo: SENZA_BURRO_DOPO_MIN },
          { attorno: SALATURA_2, prima: ASCIUGA_PRIMA_MIN, dopo: SENZA_BURRO_DOPO_MIN },
        ],
      },
      cat: 'burro',
      tag: 'burro',
      titolo: 'Unta di nuovo',
      testo: 'Riprendi il burro colato e ripassalo sullo spiedo.',
    },
    {
      chiave: 'sale1',
      quando: salatura1,
      cat: 'principali',
      tag: 'sale',
      titolo: 'Prima salatura',
      testo: 'Metà del sale, {saleMeta}. Dopo non ungere subito.',
    },
    {
      chiave: 'sale2',
      quando: SALATURA_2,
      cat: 'principali',
      tag: 'sale',
      titolo: 'Seconda salatura',
      testo: 'L\'altra metà del sale, {saleMeta}, mezz\'ora prima di tirare giù.',
    },
    ...alza,
    {
      chiave: 'fine',
      quando: { fine: 0 },
      cat: 'principali',
      tag: 'fine',
      titolo: 'Tira giù lo spiedo',
      testo: 'Sfila i pezzi in teglie calde. Tieni da parte il burro colato: la polenta lo aspetta.',
      durataMin: 20,
      graceMin: 30,
    },
  ];
}

/** Un passo "Alza la temperatura". */
const alzaTemperatura = (chiave, minuti, testo) => ({
  chiave,
  quando: { inizio: minuti },
  cat: 'principali',
  tag: 'temp',
  titolo: 'Alza la temperatura',
  testo,
});

/** Le tre fasi di cottura. `nomi` cambia tra elettrico (ore degli appunti) e brace/fuoco (durata diversa). */
const fasi = (t, nomi, [a, b, c]) => [
  { da: { inizio: 0 }, a: { inizio: t.primaFase }, nome: nomi[0], temp: a },
  { da: { inizio: t.primaFase }, a: { inizio: t.ultimaFase }, nome: nomi[1], temp: b },
  { da: { inizio: t.ultimaFase }, a: { fine: 0 }, nome: nomi[2], temp: c },
];
const NOMI_ELETTRICO = ['Prima ora', 'Seconda e terza ora', 'Ultima ora e mezza'];
const NOMI_LEGNA = ['Prima fase', 'Fase centrale', 'Fase finale'];

const T_ELETTRICO = tempi(DURATA_ELETTRICO_MIN);
const T_BRACE = tempi(DURATA_BRACE_MIN);
const T_FUOCO = tempi(DURATA_FUOCO_MIN);

export const MODALITA = {
  /* -------- BRACE: girarrosto a braci di legna -------------------------------- */
  /* ASSUNZIONE: gli appunti sono per la macchina elettrica. Qui la ricetta è la stessa, più lenta
     e con il calore espresso a braci invece che in gradi. */
  brace: {
    id: 'brace',
    nome: 'Brace',
    durataMin: T_BRACE.durataMin,
    profilo: fasi(T_BRACE, NOMI_LEGNA, ['Braci gentili', 'Braci vive', 'Braci ardenti']),
    azioni: programma({
      t: T_BRACE,
      alza: [
        alzaTemperatura('alza1', T_BRACE.primaFase, 'Porta le braci più vicine: da ora si cuoce più forte.'),
        alzaTemperatura('alza2', T_BRACE.ultimaFase, 'Ultima fase al massimo del calore. Se la carne è ancora bianca, non aspettare.'),
      ],
    }),
  },

  /* -------- FUOCO: camino / fuoco di legna acceso dietro lo spiedo ------------ */
  /* ASSUNZIONE: come per la brace, ma ancora più lento. */
  fuoco: {
    id: 'fuoco',
    nome: 'Fuoco',
    durataMin: T_FUOCO.durataMin,
    profilo: fasi(T_FUOCO, NOMI_LEGNA, ['Fuoco dolce', 'Fuoco vivo', 'Fuoco ravvivato']),
    azioni: programma({
      t: T_FUOCO,
      alza: [
        alzaTemperatura('alza1', T_FUOCO.primaFase, 'Aggiungi legna: da ora si cuoce più forte.'),
        alzaTemperatura('alza2', T_FUOCO.ultimaFase, 'Ravviva il fuoco: ultima fase al massimo. Se la carne è ancora bianca, non aspettare.'),
      ],
    }),
  },

  /* -------- ELETTRICO: macchina da spiedo con termostato (appunti di Edo) ----- */
  elettrico: {
    id: 'elettrico',
    nome: 'Elettrico',
    durataMin: T_ELETTRICO.durataMin,
    profilo: fasi(T_ELETTRICO, NOMI_ELETTRICO, ['180 °C', '220 °C', 'Massimo']),
    azioni: programma({
      t: T_ELETTRICO,
      alza: [
        alzaTemperatura('alza1', T_ELETTRICO.primaFase, 'Sali a 220 °C per le due ore successive.'),
        alzaTemperatura('alza2', T_ELETTRICO.ultimaFase, 'Ultima ora e mezza al massimo. Se dopo 3 ore la carne è ancora bianca, non aspettare.'),
      ],
    }),
  },
};

/* ----------------------------------------------------------------------------
 * 4. TAG E CATEGORIE
 * -------------------------------------------------------------------------- */

/** Etichette colorate degli eventi. `classe` è il nome della classe CSS (tag--xxx). */
export const TAG = {
  burro: { etichetta: 'BURRO', classe: 'burro' },
  sale: { etichetta: 'SALE', classe: 'sale' },
  temp: { etichetta: 'TEMPERATURA', classe: 'fuoco' },
  fine: { etichetta: 'FINE', classe: 'fine' },
};

/** Raggruppamenti che l'utente può scegliere quando decide cosa mettere in calendario.
 *  Le azioni con una categoria non elencata qui restano nella timeline dell'app
 *  ma non vengono esportate. */
export const CATEGORIE_CALENDARIO = {
  principali: { nome: 'Tappe principali', predefinita: true },
  burro: { nome: 'Unta di nuovo', predefinita: true },
};
