/**
 * Custom HTTPS dev server for Next.js.
 * Allows camera access (getUserMedia) from phones on the same local network
 * without needing a public HTTPS certificate.
 *
 * Usage: node server-https.mjs
 */
import https from 'https';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import next from 'next';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

const keyPath = join(__dirname, 'certificates', 'localhost.key');
const crtPath = join(__dirname, 'certificates', 'localhost.crt');

if (!existsSync(keyPath) || !existsSync(crtPath)) {
  console.error('❌ SSL certificates not found. Run first:');
  console.error('   node scripts/generate-cert.mjs');
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const dev = process.env.NODE_ENV !== 'production';

const app = next({ dev, hostname: '0.0.0.0', port: PORT });
const handle = app.getRequestHandler();

await app.prepare();

const httpsOptions = {
  key: readFileSync(keyPath),
  cert: readFileSync(crtPath),
};

https.createServer(httpsOptions, async (req, res) => {
  await handle(req, res);
}).listen(PORT, '0.0.0.0', () => {
  // Print all local network IPs so the user knows where to connect from their phone
  const nets = os.networkInterfaces();
  console.log('\n✅ HTTPS Server running!');
  console.log(`   Local:   https://localhost:${PORT}`);
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`   Network: https://${net.address}:${PORT}  ← open this on your phone`);
      }
    }
  }
  console.log('\n📱 On your phone: accept the security warning and proceed.');
  console.log('   Camera (getUserMedia) will then work!\n');
});
