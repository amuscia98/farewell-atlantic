#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Build del sito.
//
//   content/  (in chiaro, mai committato)  ->  docs/  (cifrato, pubblicato)
//
// In docs/ finiscono solo: HTML, CSS, JS, e per ogni giorno un JSON con
// salt, IV e ciphertext. Testi e immagini restano dentro la busta cifrata.
//
//   node build/build.mjs
// ---------------------------------------------------------------------------

import { readFile, writeFile, mkdir, rm, cp, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { leggiGiorno } from './lib/content.mjs';
import { sealPayload } from './lib/crypto.mjs';
import { normalizeAnswer } from '../src/assets/js/normalize.js';
import { nomeMese } from '../src/assets/js/datelock.js';

const RADICE = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(RADICE, 'content');
const DOCS = path.join(RADICE, 'docs');
const SRC = path.join(RADICE, 'src');

const RISPOSTE_DEBOLI = new Set([
  'natale', 'atlantic', 'password', 'segreto', 'test', 'prova', 'avvento',
  'dicembre', '1234', '12345', 'admin', 'ciao',
]);

const esc = (valore) =>
  String(valore ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const dueCifre = (n) => String(n).padStart(2, '0');

function rendi(template, valori) {
  return template.replace(/\{\{(\w+)\}\}/g, (intero, chiave) =>
    Object.hasOwn(valori, chiave) ? String(valori[chiave]) : intero,
  );
}

function kb(byte) {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} kB`;
  return `${(byte / 1024 / 1024).toFixed(2)} MB`;
}

async function esiste(percorso) {
  try {
    await stat(percorso);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------

async function main() {
  const config = JSON.parse(await readFile(path.join(RADICE, 'config.json'), 'utf8'));
  const totaleGiorni = Number(config.days) || 25;

  if (!(await esiste(CONTENT))) {
    throw new Error(
      'la cartella content/ non esiste.\n' +
        '  Lancia `npm run placeholders` per generare 25 giorni segnaposto,\n' +
        '  oppure creala a mano (vedi il README).',
    );
  }

  const templateIndex = await readFile(path.join(SRC, 'templates/index.html'), 'utf8');
  const templateDay = await readFile(path.join(SRC, 'templates/day.html'), 'utf8');

  // docs/ viene rigenerata da zero a ogni build.
  await rm(DOCS, { recursive: true, force: true });
  await mkdir(path.join(DOCS, 'data'), { recursive: true });
  await mkdir(path.join(DOCS, 'day'), { recursive: true });
  await cp(path.join(SRC, 'assets'), path.join(DOCS, 'assets'), { recursive: true });
  await writeFile(path.join(DOCS, '.nojekyll'), '');

  const avvisi = [];
  const righe = [];
  const presenti = [];
  const mancanti = [];

  // --- Quali giorni hanno contenuto? ---------------------------------------
  for (let day = 1; day <= totaleGiorni; day += 1) {
    const dir = path.join(CONTENT, `day-${dueCifre(day)}`);
    if (await esiste(path.join(dir, 'day.md'))) presenti.push({ day, dir });
    else mancanti.push(day);
  }

  if (presenti.length === 0) {
    throw new Error('in content/ non ho trovato nessun day.md. Lancia `npm run placeholders`.');
  }

  // --- Un giorno alla volta ------------------------------------------------
  for (const { day, dir } of presenti) {
    const giorno = await leggiGiorno(dir, day, config);

    const normalizzata = normalizeAnswer(giorno.risposta);
    if (normalizzata.length < 5 || RISPOSTE_DEBOLI.has(normalizzata)) {
      avvisi.push(
        `giorno ${day}: la risposta "${giorno.risposta}" è facile da indovinare. ` +
          'Il ciphertext è pubblico, quindi si può provare offline: meglio due o tre parole.',
      );
    }

    const { envelope, stats } = await sealPayload(giorno.payload, giorno.risposta, {
      iterations: Number(config.crypto.iterations) || 310000,
      compress: config.crypto.compress !== false,
    });

    const busta = {
      day,
      riddle: giorno.indovinello,
      hint: giorno.suggerimento,
      ...envelope,
    };

    const nomeDati = `day-${dueCifre(day)}.json`;
    await writeFile(path.join(DOCS, 'data', nomeDati), JSON.stringify(busta));

    // Navigazione fra i giorni che esistono davvero.
    const indice = presenti.findIndex((v) => v.day === day);
    const precedente = presenti[indice - 1];
    const successivo = presenti[indice + 1];
    const navParti = [];
    if (precedente) navParti.push(`<a href="${dueCifre(precedente.day)}.html">← Giorno ${precedente.day}</a>`);
    navParti.push('<a href="../index.html">Calendario</a>');
    if (successivo) navParti.push(`<a href="${dueCifre(successivo.day)}.html">Giorno ${successivo.day} →</a>`);

    const configPagina = {
      day,
      dataUrl: `../data/${nomeDati}`,
      dateLock: config.dateLock,
      siteTitle: config.site.title,
      navHtml: navParti.join(' · '),
    };

    const hint = giorno.suggerimento
      ? `      <details class="hint">\n` +
        `        <summary>Serve un suggerimento?</summary>\n` +
        `        <p>${esc(giorno.suggerimento)}</p>\n` +
        `      </details>`
      : '';

    await writeFile(
      path.join(DOCS, 'day', `${dueCifre(day)}.html`),
      rendi(templateDay, {
        lang: esc(config.site.lang || 'it'),
        title: esc(config.site.title),
        day: String(day),
        badge: esc(`${day} ${nomeMese(config.dateLock?.month || 12)}`),
        riddle: esc(giorno.indovinello),
        hint,
        footer: esc(config.site.footer || ''),
        configJson: JSON.stringify(configPagina).replace(/</g, '\\u003c'),
      }),
    );

    const dimensione = (await stat(path.join(DOCS, 'data', nomeDati))).size;
    righe.push({ day, dimensione, ...giorno.stats, risparmio: stats.plainSize });

    if (dimensione > 4 * 1024 * 1024) {
      avvisi.push(
        `giorno ${day}: la busta pesa ${kb(dimensione)}. Chi apre la casella la scarica tutta: ` +
          'riduci "images.maxWidth" o togli qualche foto.',
      );
    }
  }

  // --- La home -------------------------------------------------------------
  const caselle = [];
  for (let day = 1; day <= totaleGiorni; day += 1) {
    const dueC = dueCifre(day);
    if (mancanti.includes(day)) {
      caselle.push(
        `      <li><span class="tile is-locked" title="Ancora da scrivere">` +
          `<span class="tile__seal" aria-hidden="true">·</span>` +
          `<span class="tile__num">${day}</span>` +
          `<span class="tile__label">in arrivo</span></span></li>`,
      );
      continue;
    }
    caselle.push(
      `      <li><a class="tile" href="day/${dueC}.html" data-day="${day}">` +
        `<span class="tile__seal" aria-hidden="true"></span>` +
        `<span class="tile__num">${day}</span>` +
        `<span class="tile__label">dicembre</span></a></li>`,
    );
  }

  await writeFile(
    path.join(DOCS, 'index.html'),
    rendi(templateIndex, {
      lang: esc(config.site.lang || 'it'),
      title: esc(config.site.title),
      eyebrow: esc(config.site.eyebrow || ''),
      subtitle: esc(config.site.subtitle || ''),
      intro: esc(config.site.intro || ''),
      footer: esc(config.site.footer || ''),
      tiles: caselle.join('\n'),
      configJson: JSON.stringify({
        dateLock: config.dateLock,
        days: totaleGiorni,
      }).replace(/</g, '\\u003c'),
    }),
  );

  // --- Resoconto -----------------------------------------------------------
  console.log(`\n  ${config.site.title} — build completata\n`);
  console.log('  giorno   busta      immagini   video');
  console.log('  ' + '-'.repeat(42));
  for (const riga of righe) {
    console.log(
      `  ${String(riga.day).padStart(4)}   ${kb(riga.dimensione).padStart(9)}` +
        `   ${String(riga.immagini).padStart(8)}   ${String(riga.video).padStart(5)}`,
    );
  }

  const totale = righe.reduce((n, r) => n + r.dimensione, 0);
  console.log('  ' + '-'.repeat(42));
  console.log(`  ${righe.length} giorni cifrati, ${kb(totale)} in tutto`);
  if (mancanti.length) {
    console.log(`  giorni ancora senza contenuto: ${mancanti.join(', ')}`);
  }
  console.log(`  PBKDF2: ${Number(config.crypto.iterations) || 310000} iterazioni` +
    `, compressione: ${config.crypto.compress !== false ? 'sì' : 'no'}`);
  console.log(`  blocco per data: ${config.dateLock?.enabled ? `sì (dicembre ${config.dateLock.year})` : 'no'}`);

  if (avvisi.length) {
    console.log('\n  Da tenere presente:');
    for (const avviso of avvisi) console.log(`  • ${avviso}`);
  }

  console.log('\n  Sito pronto in docs/ — anteprima: npm run preview\n');
}

main().catch((errore) => {
  console.error(`\n  Build interrotta: ${errore.message}\n`);
  process.exitCode = 1;
});
