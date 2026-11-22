// ---------------------------------------------------------------------------
// Pagina di un giorno: indovinello, decifratura, contenuto.
// ---------------------------------------------------------------------------

import { initTheme } from './theme.js';
import { openDay, RispostaSbagliata } from './crypto.js';
import { normalizeAnswer } from './normalize.js';
import { rispostaSalvata, ricorda } from './store.js';
import { giornoBloccato, dataApertura } from './datelock.js';

const config = window.AVVENTO ?? {};
const day = Number(config.day);
const pubblico = Boolean(config.public);

initTheme(document.getElementById('theme-toggle'));

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

  await nascondiGate(animazione);
  mostra(contenuto);
}

// --- Avvisi al posto del contenuto -----------------------------------------

function notaGiornoPubblico(testo) {
  // I giorni pubblici non hanno il riquadro dell'indovinello: lo creiamo
  // solo per mostrare un avviso.
  const riquadro = document.createElement('section');
  riquadro.className = 'gate';
  const nota = document.createElement('p');
  nota.className = 'locked-note';
  nota.textContent = testo;
  riquadro.append(nota);
  reveal.before(riquadro);
}

const testoBloccato = () =>
  `Questa casella si apre il ${dataApertura(day, config.dateLock)}. Torna a trovarmi.`;

// --- Giorno pubblico: si mostra e basta ------------------------------------

const salvata = pubblico ? null : rispostaSalvata(day);

if (pubblico) {
  if (giornoBloccato(day, config.dateLock)) {
    notaGiornoPubblico(testoBloccato());
  } else {
    bustaPromise
      .then((busta) => mostra(busta.content ?? {}))
      .catch((errore) => notaGiornoPubblico(`Qualcosa non va: ${errore.message}`));
  }
}

// --- Blocco per data -------------------------------------------------------

else if (!salvata && giornoBloccato(day, config.dateLock)) {
  form.hidden = true;
  const nota = document.createElement('p');
  nota.className = 'locked-note';
  nota.textContent = testoBloccato();
  gate.append(nota);
} else if (salvata) {
  // Già risolto in passato: si apre da sé.
  apri(salvata, { animazione: false, salva: false }).catch(() => {
    // La risposta memorizzata non va più bene (contenuto rigenerato con
    // un'altra risposta): si torna a chiedere l'indovinello.
    gate.hidden = false;
  });
}

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
