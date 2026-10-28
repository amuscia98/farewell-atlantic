// ---------------------------------------------------------------------------
// Dal materiale in chiaro di content/day-NN/ al pacchetto da cifrare.
//
// - front-matter: indovinello, risposta, suggerimento, titolo, video, pubblico
// - corpo Markdown -> HTML
// - immagini: ridimensionate, compresse e incorporate come data URL
//   (così non finiscono mai in chiaro in docs/)
// ---------------------------------------------------------------------------

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { marked } from 'marked';
import { parseFrontMatter } from './frontmatter.mjs';

marked.setOptions({ gfm: true, breaks: true });

const ALIAS = {
  titolo: ['titolo', 'title'],
  indovinello: ['indovinello', 'riddle', 'domanda'],
  risposta: ['risposta', 'answer', 'password'],
  suggerimento: ['suggerimento', 'hint', 'aiuto'],
  video: ['video', 'videos', 'filmato', 'filmati'],
  pubblico: ['pubblico', 'pubblica', 'public'],
};

const VERO = new Set(['si', 'sì', 'true', 'yes', '1', 'vero']);
const FALSO = new Set(['no', 'false', '0', 'falso']);

function campo(dati, nome) {
  for (const alias of ALIAS[nome]) {
    if (dati[alias] !== undefined && dati[alias] !== '') return dati[alias];
  }
  return undefined;
}

// --- Video -----------------------------------------------------------------

const PATTERN_VIDEO = [
  [/youtube\.com\/watch\?(?:[^\s]*&)?v=([\w-]{6,})/i, 'youtube'],
  [/youtube\.com\/(?:embed|shorts|live)\/([\w-]{6,})/i, 'youtube'],
  [/youtube-nocookie\.com\/embed\/([\w-]{6,})/i, 'youtube'],
  [/youtu\.be\/([\w-]{6,})/i, 'youtube'],
  [/player\.vimeo\.com\/video\/(\d{5,})/i, 'vimeo'],
  [/vimeo\.com\/(?:channels\/[\w-]+\/|groups\/[\w-]+\/videos\/)?(\d{5,})/i, 'vimeo'],
];

export function leggiVideo(url) {
  const testo = String(url).trim();
  for (const [pattern, provider] of PATTERN_VIDEO) {
    const match = pattern.exec(testo);
    if (match) return { provider, id: match[1] };
  }
  return null;
}

/** Toglie dal Markdown le righe che contengono solo un link a un video. */
function estraiVideoDalCorpo(markdown) {
  const embeds = [];
  const righe = markdown.split('\n').filter((riga) => {
    const nudo = riga.trim();
    if (!/^https?:\/\/\S+$/.test(nudo)) return true;
    const video = leggiVideo(nudo);
    if (!video) return true;
    embeds.push(video);
    return false;
  });
  return { markdown: righe.join('\n'), embeds };
}

// --- Immagini --------------------------------------------------------------

const ESTENSIONI = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.tif', '.tiff', '.heic', '.heif']);

async function comprimi(file, { maxWidth, quality, format }) {
  const animata = path.extname(file).toLowerCase() === '.gif';
  let pipeline = sharp(file, animata ? { animated: true } : undefined).rotate();

  const meta = await sharp(file).metadata();
  if (meta.width && meta.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  if (format === 'jpeg') {
    const buffer = await pipeline.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toBuffer();
    return { buffer, mime: 'image/jpeg' };
  }

  const buffer = await pipeline.webp({ quality, effort: 5 }).toBuffer();
  return { buffer, mime: 'image/webp' };
}

function decodeEntita(valore) {
  return valore
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/** `<p><img ...></p>` diventa una `<figure>`, con didascalia se c'è il title. */
function avvolgiFigure(html) {
  return html.replace(/<p>(<img\b[^>]*>)<\/p>/g, (_, img) => {
    const title = /\btitle="([^"]*)"/.exec(img);
    const didascalia = title ? `<figcaption>${title[1]}</figcaption>` : '';
    return `<figure>${img}${didascalia}</figure>`;
  });
}

async function incorporaImmagini(html, dir, opzioni) {
  const cache = new Map();
  const sorgenti = [...html.matchAll(/<img\b[^>]*?\bsrc="([^"]+)"/g)].map((m) => m[1]);
  let contate = 0;

  for (const sorgente of new Set(sorgenti)) {
    const grezza = decodeEntita(sorgente);
    if (/^(https?:|data:)/i.test(grezza)) continue;

    let dataUrl = cache.get(grezza);
    if (!dataUrl) {
      const file = path.resolve(dir, grezza.replace(/^\.\//, ''));
      if (!file.startsWith(path.resolve(dir))) {
        throw new Error(`l'immagine "${grezza}" esce dalla cartella del giorno`);
      }

      const ext = path.extname(file).toLowerCase();
      if (!ESTENSIONI.has(ext)) {
        throw new Error(`formato immagine non gestito: "${grezza}"`);
      }

      let compressa;
      try {
        compressa = await comprimi(file, opzioni);
      } catch (errore) {
        const presenti = await elencaImmagini(dir);
        throw new Error(
          `non riesco a leggere l'immagine "${grezza}" (${errore.message}).` +
            (presenti.length ? ` Nella cartella trovo: ${presenti.join(', ')}.` : ' La cartella non contiene immagini.'),
        );
      }

      dataUrl = `data:${compressa.mime};base64,${compressa.buffer.toString('base64')}`;
      cache.set(grezza, dataUrl);
      contate += 1;
    }

    html = html.split(`src="${sorgente}"`).join(`src="${dataUrl}" loading="lazy" decoding="async"`);
  }

  return { html, immagini: contate, byte: [...cache.values()].reduce((n, u) => n + u.length, 0) };
}

async function elencaImmagini(dir) {
  const trovate = [];
  async function scendi(cartella, prefisso) {
    let voci;
    try {
      voci = await readdir(cartella, { withFileTypes: true });
    } catch {
      return;
    }
    for (const voce of voci) {
      if (voce.isDirectory()) await scendi(path.join(cartella, voce.name), `${prefisso}${voce.name}/`);
      else if (ESTENSIONI.has(path.extname(voce.name).toLowerCase())) trovate.push(`${prefisso}${voce.name}`);
    }
  }
  await scendi(dir, '');
  return trovate;
}

// --- Il giorno completo ----------------------------------------------------

export async function leggiGiorno(dir, day, config) {
  const file = path.join(dir, 'day.md');
  let grezzo;
  try {
    grezzo = await readFile(file, 'utf8');
  } catch {
    throw new Error(`manca il file ${path.relative(process.cwd(), file)}`);
  }

  let dati;
  let corpo;
  try {
    ({ dati, corpo } = parseFrontMatter(grezzo));
  } catch (errore) {
    throw new Error(`front-matter di ${path.relative(process.cwd(), file)}: ${errore.message}`);
  }

  const indovinello = campo(dati, 'indovinello');
  const risposta = campo(dati, 'risposta');
  const avvisi = [];

  // Un giorno è pubblico solo se lo dice esplicitamente: una risposta
  // dimenticata non deve mai far finire una dedica in chiaro nel repository.
  let pubblico = false;
  const valorePubblico = campo(dati, 'pubblico');
  if (valorePubblico !== undefined) {
    const v = String(valorePubblico).trim().toLowerCase();
    if (VERO.has(v)) pubblico = true;
    else if (!FALSO.has(v)) {
      throw new Error(`giorno ${day}: "pubblico: ${valorePubblico}" non è chiaro, scrivi "pubblico: sì" oppure "pubblico: no"`);
    }
  }

  if (pubblico) {
    if (risposta) {
      throw new Error(
        `giorno ${day}: ha sia "pubblico: sì" sia una risposta. Decidi: ` +
          'togli la risposta per renderlo pubblico, oppure togli "pubblico" per cifrarlo.',
      );
    }
    if (indovinello) avvisi.push(`giorno ${day}: è pubblico, quindi l'indovinello viene ignorato`);
  } else {
    if (!risposta) {
      throw new Error(
        `giorno ${day}: manca "risposta:" nel front-matter. ` +
          'Se questo giorno deve essere visibile a tutti senza password, scrivi "pubblico: sì".',
      );
    }
    if (!indovinello) throw new Error(`giorno ${day}: manca "indovinello:" nel front-matter`);
  }

  const { markdown, embeds } = estraiVideoDalCorpo(corpo);

  const daFrontMatter = campo(dati, 'video') ?? [];
  for (const url of Array.isArray(daFrontMatter) ? daFrontMatter : [daFrontMatter]) {
    if (!String(url).trim()) continue;
    const video = leggiVideo(url);
    if (!video) throw new Error(`giorno ${day}: non riconosco il link video "${url}" (YouTube o Vimeo)`);
    embeds.push(video);
  }

  const htmlGrezzo = avvolgiFigure(marked.parse(markdown));
  const { html, immagini, byte } = await incorporaImmagini(htmlGrezzo, dir, config.images);

  return {
    day,
    pubblico,
    avvisi,
    indovinello: pubblico ? '' : String(indovinello).trim(),
    suggerimento: !pubblico && campo(dati, 'suggerimento') ? String(campo(dati, 'suggerimento')).trim() : '',
    risposta: pubblico ? '' : String(risposta),
    payload: {
      titolo: campo(dati, 'titolo') ? String(campo(dati, 'titolo')).trim() : '',
      html,
      embeds,
    },
    stats: { immagini, byteImmagini: byte, video: embeds.length },
  };
}
