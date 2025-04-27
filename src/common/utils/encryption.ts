import * as crypto from 'crypto';

const algorithm = 'aes-256-cbc';

export function encrypt(text: string) {
  const secretKey = process.env.ENCRYPTION_SECRET_KEY;
  if (!secretKey || secretKey.length !== 64) {
    throw new Error(
      'ENCRYPTION_SECRET_KEY must be 64 hex characters (32 bytes).',
    );
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    algorithm,
    Buffer.from(secretKey, 'hex'),
    iv,
  );
  let encrypted = cipher.update(text, 'utf8');

  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string) {
  const secretKey = process.env.ENCRYPTION_SECRET_KEY;
  if (!secretKey || secretKey.length !== 64) {
    throw new Error(
      'ENCRYPTION_SECRET_KEY must be 64 hex characters (32 bytes).',
    );
  }

  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(
    algorithm,
    Buffer.from(secretKey, 'hex'), // <- important here
    iv,
  );
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
}
