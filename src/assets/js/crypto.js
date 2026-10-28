// ---------------------------------------------------------------------------
// Decifratura lato browser (Web Crypto API).
//
// Allineato a build/lib/crypto.mjs:
//   risposta normalizzata -> PBKDF2-SHA256 (salt del giorno) -> AES-GCM
//
// Richiede un contesto sicuro: https oppure http://localhost.
// Aprendo i file con file:// crypto.subtle non esiste e nulla funziona.
// ---------------------------------------------------------------------------

import { normalizeAnswer } from './normalize.js';

/** Risposta sbagliata (oppure busta manomessa): AES-GCM non autentica il dato. */
export class RispostaSbagliata extends Error {
  constructor() {
    super('risposta sbagliata');
    this.name = 'RispostaSbagliata';
  }
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(answer, salt, iterations) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalizeAnswer(answer)),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

async function gunzip(bytes) {
  if (typeof DecompressionStream !== 'function') {
    throw new Error(
      'Questo browser non supporta DecompressionStream. Rilancia la build con "compress": false in config.json.',
    );
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Apre la busta di un giorno. Restituisce l'oggetto con il contenuto.
 * Lancia RispostaSbagliata se la risposta non è quella giusta.
 */
export async function openDay(envelope, answer) {
  if (!crypto?.subtle) {
    throw new Error(
      'Web Crypto non disponibile: apri il sito via http://localhost o https, non con file://.',
    );
  }

  const key = await deriveKey(answer, fromBase64(envelope.kdf.salt), envelope.kdf.iterations);

  let bytes;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.cipher.iv) },
      key,
      fromBase64(envelope.payload),
    );
    bytes = new Uint8Array(plain);
  } catch {
    throw new RispostaSbagliata();
  }

  if (envelope.compressed) bytes = await gunzip(bytes);
  return JSON.parse(new TextDecoder().decode(bytes));
}
