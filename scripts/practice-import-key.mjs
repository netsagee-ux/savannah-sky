import {createHmac, createPrivateKey, createPublicKey} from 'node:crypto';

// The release machine can seal starter recordings for the private production store
// without ever receiving the production encryption key or storage credentials.
export function importKey(secret) {
  const seed=createHmac('sha256',secret).update('Savannah Sky/private practice import/v1').digest();
  const prefix=Buffer.from('302e020100300506032b656e04220420','hex'); // RFC 8410 X25519 PKCS#8
  return createPrivateKey({format:'der',type:'pkcs8',key:Buffer.concat([prefix,seed])});
}
