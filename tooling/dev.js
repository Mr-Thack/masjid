#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const BASE_PORT = parseInt(process.env.BASE_PORT || '5173', 10);
const APPS = ['api', 'tv', 'consumer', 'admin'];

function isPortFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.on('error', () => resolve(false));
    server.listen(port, () => { server.close(() => resolve(true)); });
  });
}

async function findBlock(startPort) {
  let port = startPort;
  while (true) {
    const block = [port, port + 1, port + 2, port + 3];
    const checks = await Promise.all(block.map((p) => isPortFree(p)));
    if (checks.every(Boolean)) return block;
    port += 10;
  }
}

const [apiPort, tvPort, consumerPort, adminPort] = await findBlock(BASE_PORT);

console.log(`  API:       http://localhost:${apiPort}`);
console.log(`  TV:        http://localhost:${tvPort}`);
console.log(`  Consumer:  http://localhost:${consumerPort}`);
console.log(`  Admin:     http://localhost:${adminPort}`);

const env = {
  ...process.env,
  API_PORT: String(apiPort),
  PORT: String(apiPort),
};

const children = [
  spawn('npm', ['run', 'dev', '--workspace=@masjid/api'], {
    stdio: 'inherit',
    env: { ...env, PORT: String(apiPort) },
  }),
  spawn('npm', ['run', 'dev', '--workspace=@masjid/tv'], {
    stdio: 'inherit',
    env: { ...env, PORT: String(tvPort) },
  }),
  spawn('npm', ['run', 'dev', '--workspace=@masjid/consumer'], {
    stdio: 'inherit',
    env: { ...env, PORT: String(consumerPort) },
  }),
  spawn('npm', ['run', 'dev', '--workspace=@masjid/admin'], {
    stdio: 'inherit',
    env: { ...env, PORT: String(adminPort) },
  }),
];

process.on('SIGINT', () => children.forEach((c) => c.kill()));
process.on('SIGTERM', () => children.forEach((c) => c.kill()));

await Promise.all(children.map((c) => new Promise((resolve) => c.on('exit', resolve))));
