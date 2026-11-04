#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Backup di content/ — copia IN CHIARO, con data e ora nel nome.
//
//   npm run backup                       -> ~/Documents/farewell-atlantic-backup/
//   npm run backup -- /Volumes/Disco     -> in un'altra cartella
//
// content/ esiste solo su questo computer: se si perde, i giorni cifrati non
// si recuperano più. La copia contiene tutte le risposte in chiaro, quindi
// non va mai messa dentro il repository: lo script si rifiuta di farlo.
// ---------------------------------------------------------------------------

import { cp, mkdir, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const RADICE = path.resolve(import.meta.dirname, '..');
const CONTENT = path.join(RADICE, 'content');
const PREDEFINITA = path.join(os.homedir(), 'Documents', 'farewell-atlantic-backup');

const dueCifre = (n) => String(n).padStart(2, '0');

function timbro(d = new Date()) {
  return `${d.getFullYear()}-${dueCifre(d.getMonth() + 1)}-${dueCifre(d.getDate())}` +
    `_${dueCifre(d.getHours())}${dueCifre(d.getMinutes())}${dueCifre(d.getSeconds())}`;
}

function espandi(percorso) {
  if (percorso === '~') return os.homedir();
  if (percorso.startsWith('~/')) return path.join(os.homedir(), percorso.slice(2));
  return path.resolve(percorso);
}

async function conta(cartella) {
  let file = 0;
  let byte = 0;
  for (const voce of await readdir(cartella, { withFileTypes: true, recursive: true })) {
    if (!voce.isFile()) continue;
    file += 1;
    byte += (await stat(path.join(voce.parentPath, voce.name))).size;
  }
  return { file, byte };
}

function mb(byte) {
  return byte < 1024 * 1024 ? `${(byte / 1024).toFixed(0)} kB` : `${(byte / 1024 / 1024).toFixed(1)} MB`;
}

async function main() {
  try {
    await stat(CONTENT);
  } catch {
    throw new Error('la cartella content/ non esiste: non c\'è niente da salvare.');
  }

  const base = espandi(process.argv[2] ?? PREDEFINITA);

  // Mai dentro il repository: finirebbe in un commit pubblico al primo `git add -A`.
  const relativo = path.relative(RADICE, base);
  if (relativo === '' || (!relativo.startsWith('..') && !path.isAbsolute(relativo))) {
    throw new Error(
      `"${base}" è dentro il repository: il backup contiene le risposte in chiaro ` +
        'e rischierebbe di finire su GitHub. Scegli una cartella fuori dal progetto.',
    );
  }

  const destinazione = path.join(base, `content-${timbro()}`);
  await mkdir(base, { recursive: true });
  await cp(CONTENT, destinazione, { recursive: true, errorOnExist: true, force: false });

  const { file, byte } = await conta(destinazione);
  console.log(`\n  Backup fatto: ${file} file, ${mb(byte)}`);
  console.log(`  ${destinazione}`);
  console.log('\n  È una copia IN CHIARO, con tutte le risposte: tienila in un posto solo tuo.');
  console.log('  Per ripristinarla: copiala nel progetto con il nome "content", poi npm run build.\n');
}

main().catch((errore) => {
  console.error(`\n  Backup non riuscito: ${errore.message}\n`);
  process.exitCode = 1;
});
