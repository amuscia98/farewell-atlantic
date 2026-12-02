// ---------------------------------------------------------------------------
// Home: stato delle 25 caselle.
// La griglia è già nell'HTML generato dalla build; qui si aggiunge solo lo
// stato che dipende dal visitatore (giorni aperti) e dalla data.
// ---------------------------------------------------------------------------

import { initTheme } from './theme.js';
import { avviaNeve } from './neve.js';
import { giorniAperti, dimenticaTutto } from './store.js';
import { statoCasella, ilGiorno, ilGiornoDi } from './datelock.js';
import { oraVera } from './oravera.js';
import { salutaCuriosi } from './curiosi.js';

const config = window.AVVENTO ?? {};

initTheme(document.getElementById('theme-toggle'));
avviaNeve();
salutaCuriosi();

const caselle = Array.from(document.querySelectorAll('[data-day]'));
// Le caselle pubbliche non hanno indovinello: sono aperte per tutti e non
// contano nel progresso.
const conIndovinello = caselle.filter((c) => !c.dataset.public).map((c) => Number(c.dataset.day));
const aperti = new Set(giorniAperti().filter((d) => conIndovinello.includes(d)));

// Casella appena sbloccata: la segnaliamo con un guizzo al ritorno dalla
// pagina del giorno.
let appenaAperto = null;
try {
  appenaAperto = Number(sessionStorage.getItem('farewell-atlantic:appena-aperto')) || null;
  sessionStorage.removeItem('farewell-atlantic:appena-aperto');
} catch {
  /* sessionStorage non disponibile: pazienza */
}

// --- Stato di ogni casella ------------------------------------------------
// Prima si usa l'orologio del computer, per disegnare subito la griglia; poi,
// appena arriva l'ora del server, si corregge: chi ha spostato avanti la data
// trova il carbone.

for (const casella of caselle) {
  // si ricorda com'era la casella, per poterla rimettere a posto
  casella.dataset.etichetta = casella.querySelector('.tile__label')?.textContent ?? '';
  casella.dataset.sigillo = casella.querySelector('.tile__seal')?.textContent ?? '';
  casella.addEventListener('click', (evento) => {
    if (casella.classList.contains('is-locked')) evento.preventDefault();
  });
}

function applicaStato(casella, stato) {
  const day = Number(casella.dataset.day);
  const etichetta = casella.querySelector('.tile__label');
  const sigillo = casella.querySelector('.tile__seal');
  const scrivi = (testoEtichetta, testoSigillo) => {
    if (etichetta) etichetta.textContent = testoEtichetta;
    if (sigillo) sigillo.textContent = testoSigillo;
  };

  casella.classList.remove('is-locked', 'is-carbone');
  casella.classList.toggle('is-public', Boolean(casella.dataset.public));
  casella.removeAttribute('aria-disabled');
  casella.removeAttribute('title');

  if (aperti.has(day)) {
    casella.classList.add('is-open');
    scrivi('aperta', '✦');
    if (day === appenaAperto) casella.classList.add('just-opened');
  } else if (stato === 'carbone') {
    casella.classList.remove('is-public');
    casella.classList.add('is-carbone');
    casella.title = 'Hai spostato avanti la data del computer? Niente da fare: carbone! 🪨';
    scrivi('carbone', '🪨');
  } else if (stato === 'bloccata') {
    casella.classList.remove('is-public');
    casella.classList.add('is-locked');
    casella.setAttribute('aria-disabled', 'true');
    casella.title = `Si apre ${ilGiorno(day, config.dateLock)}`;
    scrivi('non ancora', '·');
  } else {
    scrivi(casella.dataset.etichetta, casella.dataset.sigillo);
  }
}

for (const casella of caselle) {
  applicaStato(casella, statoCasella(Number(casella.dataset.day), config.dateLock));
}

if (config.dateLock?.enabled) {
  oraVera().then((ora) => {
    let carbone = 0;
    for (const casella of caselle) {
      const stato = statoCasella(Number(casella.dataset.day), config.dateLock, ora);
      if (stato === 'carbone' && !casella.classList.contains('is-open')) carbone += 1;
      applicaStato(casella, stato);
    }
    if (carbone > 0) avvisaViaggiatore(ora);
  });
}

// Un avviso sotto al titolo per chi ha spostato avanti l'orologio.
function avvisaViaggiatore(ora) {
  if (document.querySelector('.avviso-carbone')) return;
  const avviso = document.createElement('p');
  avviso.className = 'avviso-carbone';
  avviso.textContent =
    `🕰️ Il tuo computer dice che è ${ilGiornoDi(new Date())}, ma Babbo Natale sa che oggi è ` +
    `${ilGiornoDi(ora.adesso())}. Niente trucchi: chi bara trova il carbone 🪨`;
  document.querySelector('.site-head')?.append(avviso);
}

// --- Riga di progresso -----------------------------------------------------

const progresso = document.getElementById('progress');
if (progresso) {
  const totale = conIndovinello.length;
  const n = aperti.size;

  let testo;
  if (totale === 0) testo = '';
  else if (n === 0) testo = `Nessun indovinello risolto, per ora. ${totale === 1 ? 'Uno ti aspetta' : `${totale} ti aspettano`}.`;
  else if (n === totale) testo = `Tutti gli indovinelli risolti. Grazie di essere arrivato fino in fondo.`;
  else testo = `${n} ${n === 1 ? 'indovinello risolto' : 'indovinelli risolti'} su ${totale}.`;

  progresso.textContent = testo;

  if (n > 0) {
    const azzera = document.createElement('button');
    azzera.type = 'button';
    azzera.textContent = 'ricomincia da zero';
    azzera.addEventListener('click', () => {
      dimenticaTutto();
      window.location.reload();
    });
    progresso.append(' ', azzera);
  }
}
