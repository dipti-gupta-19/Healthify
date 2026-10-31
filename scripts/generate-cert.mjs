/**
 * Generates a self-signed SSL certificate for local HTTPS development.
 * Uses Node.js built-in `crypto` — no admin rights or external tools needed.
 * Output: certificates/localhost.key + certificates/localhost.crt
 */
import { execSync } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const certDir = join(__dirname, '..', 'certificates');

if (!existsSync(certDir)) {
  mkdirSync(certDir, { recursive: true });
}

const keyPath = join(certDir, 'localhost.key');
const crtPath = join(certDir, 'localhost.crt');

if (existsSync(keyPath) && existsSync(crtPath)) {
  console.log('✅ Certificates already exist, skipping generation.');
  process.exit(0);
}

console.log('🔐 Generating self-signed certificate...');

try {
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${crtPath}" -days 365 -nodes -subj "/CN=localhost" -addext "subjectAltName=IP:0.0.0.0,IP:127.0.0.1,DNS:localhost"`,
    { stdio: 'inherit' }
  );
  console.log('✅ Certificate generated successfully!');
  console.log(`   Key: ${keyPath}`);
  console.log(`   Cert: ${crtPath}`);
} catch {
  // openssl not available — fallback to Node crypto
  console.log('⚠ openssl not found, using Node.js crypto fallback...');
  const { generateKeyPairSync, createSign } = await import('crypto');

  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });

  const { writeFileSync } = await import('fs');
  writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }));

  // For the cert we still need openssl or a library — advise user
  console.error('❌ Cannot generate cert without openssl. Please install openssl:');
  console.error('   winget install ShiningLight.OpenSSL.Light');
  console.error('   Then re-run: node scripts/generate-cert.mjs');
  process.exit(1);
}
