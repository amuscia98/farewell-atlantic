// ---------------------------------------------------------------------------
// Pagina di un giorno: indovinello, decifratura, contenuto.
// ---------------------------------------------------------------------------

import { initTheme } from './theme.js';
import { avviaNeve } from './neve.js';
import { openDay, RispostaSbagliata } from './crypto.js';
import { normalizeAnswer } from './normalize.js';
import { rispostaSalvata, ricorda } from './store.js';
import { statoCasella, ilGiorno, ilGiornoDi } from './datelock.js';
import { oraVera } from './oravera.js';
import { salutaCuriosi } from './curiosi.js';

const config = window.AVVENTO ?? {};
const day = Number(config.day);
const pubblico = Boolean(config.public);

initTheme(document.getElementById('theme-toggle'));
avviaNeve();
salutaCuriosi();

const gate = document.getElementById('gate');
const form = document.getElementById('gate-form');
const input = document.getElementById('answer');
const bottone = document.getElementById('gate-submit');
const messaggio = document.getElementById('gate-msg');
const reveal = document.getElementById('reveal');

const motoRidotto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// La busta cifrata si scarica subito: quando il visitatore ha finito di
// leggere l'indovinello è già in memoria.
const bustaPromise = fetch(config.dataUrl, { cache: 'no-cache' }).then((r) => {
  if (!r.ok) throw new Error(`non riesco a leggere ${config.dataUrl} (HTTP ${r.status})`);
  return r.json();
});
bustaPromise.catch(() => { /* gestito al momento dell'apertura */ });

// --- Resa del contenuto ----------------------------------------------------

function iframeEmbed(embed) {
  const inizio = Number(embed.inizio) > 0 ? Math.floor(Number(embed.inizio)) : 0;
  const src =
    embed.provider === 'vimeo'
      ? `https://player.vimeo.com/video/${embed.id}${inizio ? `#t=${inizio}s` : ''}`
      : `https://www.youtube-nocookie.com/embed/${embed.id}?rel=0${inizio ? `&start=${inizio}` : ''}`;

  const wrapper = document.createElement('div');
  wrapper.className = 'embed';

  const frame = document.createElement('iframe');
  frame.src = src;
  frame.loading = 'lazy';
  frame.title = embed.titolo || 'Video';
  frame.allow = 'accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen';
  frame.setAttribute('allowfullscreen', '');
  frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

  wrapper.append(frame);
  return wrapper;
}

// --- Foto a schermo intero -----------------------------------------------
// Ogni foto del contenuto si ingrandisce con un clic (o Invio da tastiera).
// Si chiude con un altro clic, con il pulsante ✕ o con Esc.

let lightbox = null;

function preparaLightbox() {
  if (lightbox) return lightbox;

  lightbox = document.createElement('dialog');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('aria-label', 'Foto a schermo intero');

  const chiudi = document.createElement('button');
  chiudi.type = 'button';
  chiudi.className = 'lightbox__close';
  chiudi.setAttribute('aria-label', 'Chiudi');
  chiudi.textContent = '✕';

  const img = document.createElement('img');
  img.className = 'lightbox__img';

  const didascalia = document.createElement('p');
  didascalia.className = 'lightbox__caption';

  lightbox.append(chiudi, img, didascalia);
  lightbox.addEventListener('click', () => lightbox.close());
  document.body.append(lightbox);
  return lightbox;
}

function ingrandisci(foto) {
  const dialogo = preparaLightbox();
  const img = dialogo.querySelector('.lightbox__img');
  const didascalia = dialogo.querySelector('.lightbox__caption');

  img.src = foto.currentSrc || foto.src;
  img.alt = foto.alt;
  const testo = foto.closest('figure')?.querySelector('figcaption')?.textContent ?? '';
  didascalia.textContent = testo;
  didascalia.hidden = !testo;

  dialogo.showModal();
}

function rendiIngrandibili(corpo) {
  for (const foto of corpo.querySelectorAll('img')) {
    if (foto.closest('a')) continue; // una foto-link resta un link
    foto.classList.add('is-zoomable');
    foto.tabIndex = 0;
    foto.setAttribute('role', 'button');
    foto.setAttribute('aria-label', `Ingrandisci${foto.alt ? `: ${foto.alt}` : ' la foto'}`);
    foto.addEventListener('click', () => ingrandisci(foto));
    foto.addEventListener('keydown', (evento) => {
      if (evento.key === 'Enter' || evento.key === ' ') {
        evento.preventDefault();
        ingrandisci(foto);
      }
    });
  }
}

function freccia(verso, etichetta, simbolo) {
  const bottone = document.createElement('button');
  bottone.type = 'button';
  bottone.className = `carosello__freccia carosello__freccia--${verso}`;
  bottone.setAttribute('aria-label', etichetta);
  bottone.textContent = simbolo;
  return bottone;
}

/** Aggiunge frecce e pallini ai caroselli generati dalla build (#carosello). */
function preparaCaroselli(corpo) {
  for (const carosello of corpo.querySelectorAll('.carosello')) {
    const binario = carosello.querySelector('.carosello__binario');
    const foto = binario ? [...binario.children] : [];
    if (foto.length < 2) continue;

    binario.tabIndex = 0;
    binario.setAttribute('role', 'region');
    binario.setAttribute('aria-roledescription', 'carosello');
    binario.setAttribute('aria-label', `Galleria di ${foto.length} foto: usa le frecce per scorrerle`);

    // Le foto oltre la prima si decodificano solo quando servono.
    foto.forEach((figura, i) => {
      const img = figura.querySelector('img');
      if (!img) return;
      img.decoding = 'async';
      if (i > 0) img.loading = 'lazy';
    });

    const vista = document.createElement('div');
    vista.className = 'carosello__vista';
    binario.before(vista);
    vista.append(binario);

    const prec = freccia('prec', 'Foto precedente', '‹');
    const succ = freccia('succ', 'Foto successiva', '›');
    vista.append(prec, succ);

    // Fino a 8 foto un pallino per foto; oltre, un contatore "3 / 18"
    // (tanti pallini non starebbero sullo schermo di un telefono).
    const punti = document.createElement('div');
    punti.className = 'carosello__punti';
    const conPallini = foto.length <= 8;
    const bottoni = conPallini
      ? foto.map((_, i) => {
          const punto = document.createElement('button');
          punto.type = 'button';
          punto.className = 'carosello__punto';
          punto.setAttribute('aria-label', `Foto ${i + 1} di ${foto.length}`);
          punto.addEventListener('click', () => vai(i));
          return punto;
        })
      : [];
    const conto = document.createElement('span');
    conto.className = 'carosello__conto';
    conto.setAttribute('aria-live', 'polite');
    if (conPallini) punti.append(...bottoni);
    else punti.append(conto);
    carosello.append(punti);

    let attuale = -1;
    const indice = () => Math.round(binario.scrollLeft / Math.max(1, binario.clientWidth));
    const vai = (i) => {
      const destinazione = Math.max(0, Math.min(foto.length - 1, i));
      binario.scrollTo({
        left: destinazione * binario.clientWidth,
        behavior: motoRidotto ? 'auto' : 'smooth',
      });
    };
    const aggiorna = () => {
      const i = indice();
      if (i === attuale) return;
      attuale = i;
      bottoni.forEach((b, j) => b.setAttribute('aria-current', String(j === i)));
      conto.textContent = `${i + 1} / ${foto.length}`;
      // un video che esce dalla vista si ferma
      foto.forEach((figura, j) => {
        const video = figura.querySelector('video');
        if (video && j !== i && !video.paused) video.pause();
      });
      prec.disabled = i === 0;
      succ.disabled = i === foto.length - 1;
    };

    prec.addEventListener('click', () => vai(indice() - 1));
    succ.addEventListener('click', () => vai(indice() + 1));
    binario.addEventListener('keydown', (evento) => {
      if (evento.key === 'ArrowLeft') vai(indice() - 1);
      else if (evento.key === 'ArrowRight') vai(indice() + 1);
      else return;
      evento.preventDefault();
    });
    let inAttesa = false;
    binario.addEventListener('scroll', () => {
      if (inAttesa) return;
      inAttesa = true;
      requestAnimationFrame(() => {
        inAttesa = false;
        aggiorna();
      });
    }, { passive: true });
    aggiorna();
  }
}

/** I video locali arrivano dentro la busta: li diamo al player come blob. */
async function preparaVideo(corpo) {
  for (const video of corpo.querySelectorAll('video[data-video]')) {
    try {
      const blob = await (await fetch(video.dataset.video)).blob();
      // #t=0.001 fa mostrare il primo fotogramma anche su iPhone.
      video.src = `${URL.createObjectURL(blob)}#t=0.001`;
    } catch {
      video.replaceWith(document.createTextNode('(questo video non si riesce a riprodurre qui)'));
    }
    video.removeAttribute('data-video');
  }
}

function mostra(contenuto) {
  reveal.replaceChildren();

  if (contenuto.titolo) {
    const h = document.createElement('h2');
    h.className = 'reveal__title';
    h.textContent = contenuto.titolo;
    reveal.append(h);
  }

  const corpo = document.createElement('div');
  corpo.className = 'reveal__body';
  // Il contenuto arriva dalla cartella content/ di chi costruisce il sito,
  // non da estranei: l'HTML è quello generato dalla build dal Markdown.
  corpo.innerHTML = contenuto.html ?? '';
  for (const embed of contenuto.embeds ?? []) corpo.append(iframeEmbed(embed));
  rendiIngrandibili(corpo);
  reveal.append(corpo);
  preparaCaroselli(corpo);
  preparaVideo(corpo);

  const nav = document.createElement('p');
  nav.className = 'reveal__next';
  nav.innerHTML = config.navHtml ?? '';
  reveal.append(nav);

  reveal.hidden = false;
  document.title = contenuto.titolo
    ? `${contenuto.titolo} — ${config.siteTitle}`
    : document.title;
}

function nascondiGate(conAnimazione) {
  if (!conAnimazione || motoRidotto) {
    gate.hidden = true;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    let fatto = false;
    const fine = () => {
      if (fatto) return;
      fatto = true;
      gate.hidden = true;
      resolve();
    };
    gate.addEventListener('animationend', fine, { once: true });
    setTimeout(fine, 500);
    gate.classList.add('is-leaving');
  });
}

// Una manciata di stelline dorate che schizzano fuori dal riquadro
// dell'indovinello quando la risposta è giusta. Niente per chi ha chiesto
// meno movimento.
function stelline(origine) {
  if (motoRidotto || typeof Element.prototype.animate !== 'function') return;

  const box = origine.getBoundingClientRect();
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const stile = getComputedStyle(document.documentElement);
  const colori = [1, 2, 3, 4].map((n) => stile.getPropertyValue(`--sparkle-${n}`).trim() || '#e2bc7c');

  const strato = document.createElement('div');
  strato.className = 'stelline';
  strato.setAttribute('aria-hidden', 'true');
  document.body.append(strato);

  const QUANTE = 34;
  let durataMassima = 0;
  for (let i = 0; i < QUANTE; i += 1) {
    const stella = document.createElement('span');
    if (i % 3 === 0) stella.className = 'scintilla';
    const lato = 8 + Math.random() * 14;
    // il rosso solo ogni tanto, il resto oro e panna
    const colore = i % 7 === 0 ? colori[3] : colori[i % 3];
    Object.assign(stella.style, {
      width: `${lato}px`,
      height: `${lato}px`,
      left: `${cx - lato / 2}px`,
      top: `${cy - lato / 2}px`,
      background: colore,
    });
    strato.append(stella);

    const angolo = Math.random() * Math.PI * 2;
    const distanza = 80 + Math.random() * Math.min(240, window.innerWidth * 0.45);
    const dx = Math.cos(angolo) * distanza;
    const dy = Math.sin(angolo) * distanza * 0.8 + 70; // un po' di gravità
    const giro = (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 270);
    const durata = 900 + Math.random() * 700;
    durataMassima = Math.max(durataMassima, durata);

    stella.animate(
      [
        { transform: 'translate(0, 0) scale(0.2) rotate(0deg)', opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { opacity: 1, offset: 0.6 },
        { transform: `translate(${dx}px, ${dy}px) scale(1) rotate(${giro}deg)`, opacity: 0 },
      ],
      { duration: durata, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'forwards' },
    );
  }
  setTimeout(() => strato.remove(), durataMassima + 100);
}

async function apri(risposta, { animazione = true, salva = true } = {}) {
  const busta = await bustaPromise;
  const contenuto = await openDay(busta, risposta);

  if (salva) {
    ricorda(day, normalizeAnswer(risposta));
    try {
      sessionStorage.setItem('farewell-atlantic:appena-aperto', String(day));
    } catch {
      /* niente guizzo sulla home, nulla di grave */
    }
  }

  if (animazione) stelline(gate);
  await nascondiGate(animazione);
  mostra(contenuto);
}

// --- Avvisi al posto del contenuto -----------------------------------------

// Mette un avviso al posto dell'indovinello. I giorni pubblici non hanno il
// riquadro: lo si crea apposta.
function mostraAvviso(nodo) {
  let riquadro = gate;
  if (!riquadro) {
    riquadro = document.createElement('section');
    riquadro.className = 'gate';
    reveal.before(riquadro);
  }
  for (const elemento of riquadro.children) elemento.hidden = true;
  riquadro.prepend(nodo);
}

function avviso(testo) {
  const nota = document.createElement('p');
  nota.className = 'locked-note';
  nota.textContent = testo;
  return nota;
}

const testoBloccato = () =>
  `Questa casella si apre ${ilGiorno(day, config.dateLock)}. Torna a trovarmi.`;

// Easter egg per chi ha spostato avanti la data del computer.
function carbone(ora) {
  const box = document.createElement('div');
  box.className = 'locked-note carbone';
  const righe = [
    ['carbone__sasso', '🪨'],
    ['carbone__titolo', 'Bel tentativo, viaggiatore nel tempo 🕰️'],
    [
      '',
      `Il tuo computer dice che è ${ilGiornoDi(new Date())}, ma il calendario sa che oggi è ` +
        `${ilGiornoDi(ora.adesso())}. Questa casella si apre ${ilGiorno(day, config.dateLock)}, quello vero.`,
    ],
    ['', "Nel frattempo eccoti il carbone che ti sei meritato. Rimetti a posto l'orologio e torna a trovarmi 😉"],
  ];
  for (const [classe, testo] of righe) {
    const p = document.createElement('p');
    if (classe) p.className = classe;
    if (classe === 'carbone__sasso') p.setAttribute('aria-hidden', 'true');
    p.textContent = testo;
    box.append(p);
  }
  return box;
}

// --- Si decide cosa mostrare ----------------------------------------------
// Con il blocco per data attivo si aspetta l'ora del server (pochi decimi di
// secondo): fino ad allora il riquadro resta nascosto (classe
// "giorno-in-verifica", messa da uno script nella <head>).

const salvata = pubblico ? null : rispostaSalvata(day);

async function decidi() {
  const ora = config.dateLock?.enabled ? await oraVera() : null;
  const stato = statoCasella(day, config.dateLock, ora);

  if (pubblico) {
    if (stato === 'carbone') mostraAvviso(carbone(ora));
    else if (stato === 'bloccata') mostraAvviso(avviso(testoBloccato()));
    else {
      bustaPromise
        .then((busta) => mostra(busta.content ?? {}))
        .catch((errore) => mostraAvviso(avviso(`Qualcosa non va: ${errore.message}`)));
    }
  } else if (salvata) {
    // Già risolto in passato: si apre da sé.
    apri(salvata, { animazione: false, salva: false }).catch(() => {
      // La risposta memorizzata non va più bene (contenuto rigenerato con
      // un'altra risposta): si torna a chiedere l'indovinello.
      gate.hidden = false;
    });
  } else if (stato === 'carbone') {
    mostraAvviso(carbone(ora));
  } else if (stato === 'bloccata') {
    // Prima del suo giorno la casella mostra solo l'avviso: niente
    // indovinello, suggerimento né campo della risposta.
    mostraAvviso(avviso(testoBloccato()));
  }

  document.documentElement.classList.remove('giorno-in-verifica');
}

decidi();

// --- Invio della risposta --------------------------------------------------

form?.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  const risposta = input.value;
  if (!normalizeAnswer(risposta)) {
    messaggio.textContent = 'Scrivi la tua risposta qui sopra.';
    messaggio.classList.add('is-error');
    input.focus();
    return;
  }

  bottone.disabled = true;
  messaggio.classList.remove('is-error');
  messaggio.textContent = 'Apro…';

  if (config.dateLock?.enabled && statoCasella(day, config.dateLock, await oraVera()) !== 'libera') {
    window.location.reload();
    return;
  }

  try {
    await apri(risposta);
  } catch (errore) {
    bottone.disabled = false;
    messaggio.classList.add('is-error');

    if (errore instanceof RispostaSbagliata) {
      messaggio.textContent = 'Non è questa. Riprova — il suggerimento è qui sotto.';
      gate.classList.remove('is-wrong');
      void gate.offsetWidth; // riavvia l'animazione
      gate.classList.add('is-wrong');
      input.select();
    } else {
      messaggio.textContent = `Qualcosa non va: ${errore.message}`;
    }
  }
});
