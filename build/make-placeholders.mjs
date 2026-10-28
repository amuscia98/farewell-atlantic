#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Genera 25 giorni segnaposto in content/, così il sito si può provare subito.
//
//   node build/make-placeholders.mjs            (non tocca i giorni esistenti)
//   node build/make-placeholders.mjs --force    (riscrive tutto)
//
// Sono tutti da sostituire: indovinelli, risposte, testi e immagini.
// ---------------------------------------------------------------------------

import { writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const RADICE = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(RADICE, 'content');
const FORZA = process.argv.includes('--force');

const GIORNI = [
  { titolo: 'La pausa di metà mattina', indovinello: 'Dura tre minuti in piedi\ne risolve più problemi di una riunione da un’ora.', risposta: 'pausa caffè', suggerimento: 'Due parole, e ci vuole una tazzina.' },
  { titolo: 'Il lunedì mattina', indovinello: 'Comincia sempre con «mi sentite?»\ne finisce dieci minuti oltre l’ora.', risposta: 'call del lunedì', suggerimento: 'Succede a inizio settimana.' },
  { titolo: 'La stanza con il nome di una città', indovinello: 'Ha quattro pareti, un proiettore che non si collega mai\ne il nome di un posto dove nessuno è stato.', risposta: 'sala riunioni', suggerimento: 'Si prenota, e c’è sempre occupata.' },
  { titolo: 'Quello che cerchi nelle tasche', indovinello: 'Senza di lui resti fuori,\ncon lui entri ovunque.', risposta: 'badge aziendale', suggerimento: 'Si appende al collo.' },
  { titolo: 'Monete e conforto', indovinello: 'Mangia monete\ne restituisce conforto in bicchieri di plastica.', risposta: 'distributore automatico', suggerimento: 'Sta in corridoio e ogni tanto si inceppa.' },
  { titolo: 'Righe e colonne', indovinello: 'Ha righe, colonne\ne una formula che nessuno osa toccare.', risposta: 'foglio excel', suggerimento: 'Due parole, la seconda è un programma.' },
  { titolo: 'Quello che non si dovrebbe fare', indovinello: 'Tutti dicono di non farlo,\ne qualcuno lo fa comunque, alle cinque e mezza.', risposta: 'deploy del venerdì', suggerimento: 'Riguarda l’ultimo giorno della settimana.' },
  { titolo: 'Funziona sempre, tranne una volta', indovinello: 'Funziona per giorni,\ntranne nel momento in cui guardano tutti.', risposta: 'demo al cliente', suggerimento: 'Succede davanti a chi paga.' },
  { titolo: 'Cento conversazioni', indovinello: 'Cento conversazioni diverse\ne nessuna porta da chiudere.', risposta: 'open space', suggerimento: 'È il modo in cui sono fatti gli uffici moderni.' },
  { titolo: 'L’ufficio con un altro indirizzo', indovinello: 'Valigia piccola, sveglia presto, cena insieme:\nper qualche giorno l’ufficio cambia indirizzo.', risposta: 'trasferta', suggerimento: 'Una parola sola, si fa in treno o in aereo.' },
  { titolo: 'Si divide in parti disuguali', indovinello: 'Si ordina quando un progetto finisce\ne si divide sempre in parti disuguali.', risposta: 'pizza di squadra', suggerimento: 'Si mangia, ed è tonda.' },
  { titolo: 'Il posto più democratico', indovinello: 'A mezzogiorno diventa\nil posto più democratico dell’ufficio.', risposta: 'pausa pranzo', suggerimento: 'Succede ogni giorno verso l’una.' },
  { titolo: 'Le 17:45', indovinello: 'Arriva alle 17:45\ne ha sempre la stessa priorità: massima.', risposta: 'ticket urgente', suggerimento: 'Si apre e si chiude, ma non è una porta.' },
  { titolo: 'Due settimane di promesse', indovinello: 'Due settimane di promesse,\nscritte su biglietti colorati.', risposta: 'sprint planning', suggerimento: 'Vocabolario agile.' },
  { titolo: 'Cosa è andato bene', indovinello: 'Si dice cosa è andato bene, cosa no,\ne si promette di cambiare qualcosa.', risposta: 'retrospettiva', suggerimento: 'Si guarda indietro.' },
  { titolo: 'Frecce e scatole', indovinello: 'Si riempie di frecce e scatole\ne nessuno la cancella mai del tutto.', risposta: 'lavagna bianca', suggerimento: 'Ci si scrive con i pennarelli.' },
  { titolo: 'Dieci appunti e un attestato', indovinello: 'Ci entri per imparare una cosa\ne ne esci con dieci appunti e un attestato.', risposta: 'aula formazione', suggerimento: 'Si impara, ma non è la scuola.' },
  { titolo: 'Una volta all’anno', indovinello: 'Una volta all’anno tutti si vestono bene\ne scoprono di avere altri argomenti.', risposta: 'cena di natale', suggerimento: 'Succede a dicembre.' },
  { titolo: 'Il regalo anonimo', indovinello: 'Un regalo anonimo, un budget preciso,\nuna risata garantita.', risposta: 'babbo natale segreto', suggerimento: 'In inglese si direbbe Secret Santa.' },
  { titolo: 'La casella piena', indovinello: 'L’ufficio resta vuoto\ne la casella di posta si riempie.', risposta: 'ferie di agosto', suggerimento: 'Il mese più caldo.' },
  { titolo: 'Non si dimentica', indovinello: 'Non si dimentica mai:\nil nome, la fretta, la paura di sbagliare.', risposta: 'primo cliente', suggerimento: 'Viene prima di tutti gli altri.' },
  { titolo: 'Metà delle lamentele', indovinello: 'Divide con te il rumore della tastiera\ne la metà delle lamentele.', risposta: 'collega di scrivania', suggerimento: 'Sta seduto accanto a te.' },
  { titolo: 'Un cassetto e una chat', indovinello: 'Si svuota un cassetto\ne si riempie una chat di messaggi.', risposta: 'ultimo giorno', suggerimento: 'È il contrario del primo.' },
  { titolo: 'La sera in cui tutto rallenta', indovinello: 'La sera in cui tutto rallenta\ne non resta che aspettare.', risposta: 'la vigilia', suggerimento: 'Viene prima del 25.' },
  { titolo: 'Impossibile da restituire', indovinello: 'Due parole difficili da dire\ne impossibili da restituire:\nsono la ragione di questo calendario.', risposta: 'grazie di tutto', suggerimento: 'È quello che vorrei dirvi, e infatti è la risposta.' },
];

const dueCifre = (n) => String(n).padStart(2, '0');

function svgSegnaposto(day, titolo) {
  const toni = [
    ['#101522', '#1d2740'],
    ['#141a14', '#223324'],
    ['#1a1421', '#30223a'],
    ['#1b1512', '#3a2a1d'],
  ];
  const [a, b] = toni[(day - 1) % toni.length];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${a}"/>
      <stop offset="1" stop-color="${b}"/>
    </linearGradient>
  </defs>
  <rect width="1600" height="900" fill="url(#g)"/>
  <circle cx="1320" cy="190" r="150" fill="#c59a55" opacity="0.14"/>
  <circle cx="250" cy="760" r="210" fill="#c59a55" opacity="0.08"/>
  <text x="120" y="430" font-family="Georgia, serif" font-size="300" fill="#e2bc7c" opacity="0.9">${day}</text>
  <text x="128" y="520" font-family="Helvetica, Arial, sans-serif" font-size="46" fill="#eceff5" opacity="0.75">${titolo.replace(/[<>&]/g, '')}</text>
  <text x="128" y="590" font-family="Helvetica, Arial, sans-serif" font-size="28" fill="#9aa4b8" letter-spacing="6">IMMAGINE SEGNAPOSTO</text>
</svg>`);
}

async function esiste(percorso) {
  try {
    await stat(percorso);
    return true;
  } catch {
    return false;
  }
}

function corpo(day, dati) {
  const extra =
    day === 25
      ? `\nUn video si aggiunge così: basta incollare il link su una riga da solo,\noppure metterlo nel front-matter sotto \`video:\`. Finisce dentro la parte\ncifrata, quindi il link non è leggibile da chi non risolve l'indovinello.\n`
      : '';

  return `Questo è un testo segnaposto per il **giorno ${day}**: sostituiscilo con la tua
dedica. Puoi usare il *Markdown* che ti serve — grassetto, corsivo, elenchi,
citazioni, titoli.

> Una citazione, se ti va: le cose belle di questo posto sono state le persone.

![${dati.titolo}](img/segnaposto.jpg "Didascalia di esempio — il testo fra virgolette diventa la didascalia")

Le immagini vanno in \`img/\` dentro questa cartella: la build le ridimensiona,
le comprime e le incorpora **dentro il pacchetto cifrato**, mai in chiaro.
${extra}`;
}

async function main() {
  let creati = 0;
  let saltati = 0;

  for (let day = 1; day <= GIORNI.length; day += 1) {
    const dati = GIORNI[day - 1];
    const dir = path.join(CONTENT, `day-${dueCifre(day)}`);
    const file = path.join(dir, 'day.md');

    if (!FORZA && (await esiste(file))) {
      saltati += 1;
      continue;
    }

    await mkdir(path.join(dir, 'img'), { recursive: true });

    const testo = `---
titolo: ${dati.titolo}
indovinello: |
${dati.indovinello.split('\n').map((riga) => `  ${riga}`).join('\n')}
risposta: ${dati.risposta}
suggerimento: ${dati.suggerimento}
# Video (YouTube "non in elenco" o Vimeo): togli il cancelletto e incolla i link.
# video:
#   - https://youtu.be/XXXXXXXXXXX
---

${corpo(day, dati)}`;

    await writeFile(file, testo, 'utf8');

    await sharp(svgSegnaposto(day, dati.titolo))
      .jpeg({ quality: 82 })
      .toFile(path.join(dir, 'img', 'segnaposto.jpg'));

    creati += 1;
  }

  console.log(`\n  Segnaposto: ${creati} giorni creati, ${saltati} già presenti e lasciati stare.`);
  console.log('  Stanno in content/ — che è in .gitignore, quindi non finiscono su GitHub.');
  console.log('  Ora: npm run build\n');
}

main().catch((errore) => {
  console.error(`\n  Non sono riuscito a creare i segnaposto: ${errore.message}\n`);
  process.exitCode = 1;
});
