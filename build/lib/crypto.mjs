// ---------------------------------------------------------------------------
// Cifratura lato build.
//
// Deve restare allineato a src/assets/js/crypto.js (lato browser):
//   risposta normalizzata -> PBKDF2-SHA256 (salt casuale per giorno) -> AES-GCM
// ---------------------------------------------------------------------------

import { webcrypto as crypto } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { normalizeAnswer } from '../../src/assets/js/normalize.js';

const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BITS = 256;

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
    { name: 'AES-GCM', length: KEY_BITS },
    false,
    ['encrypt'],
  );
}

/**
 * Cifra l'oggetto `payload` usando `answer` come chiave.
 * Restituisce la busta da scrivere in docs/data/day-NN.json (solo roba pubblica).
 */
export async function sealPayload(payload, answer, { iterations, compress }) {
  if (!normalizeAnswer(answer)) {
    throw new Error('la risposta normalizzata è vuota: serve almeno una lettera o una cifra');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(answer, salt, iterations);

  let bytes = Buffer.from(JSON.stringify(payload), 'utf8');
  const plainSize = bytes.length;
  if (compress) bytes = gzipSync(bytes, { level: 9 });

  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);

  return {
    envelope: {
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations,
        salt: Buffer.from(salt).toString('base64'),
      },
      cipher: {
        name: 'AES-GCM',
        iv: Buffer.from(iv).toString('base64'),
      },
      compressed: Boolean(compress),
      payload: Buffer.from(sealed).toString('base64'),
    },
    stats: { plainSize, sealedSize: sealed.byteLength },
  };
}
