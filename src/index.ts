import 'dotenv/config';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import fs from 'fs';

// Optional HTTPS/mTLS if cert and key are provided
const tlsCertPath = process.env.TLS_CERT_PATH;
const tlsKeyPath = process.env.TLS_KEY_PATH;
let httpsOptions: { key: Buffer; cert: Buffer } | undefined;
if (tlsCertPath && tlsKeyPath && fs.existsSync(tlsCertPath) && fs.existsSync(tlsKeyPath)) {
  httpsOptions = {
    key: fs.readFileSync(tlsKeyPath),
    cert: fs.readFileSync(tlsCertPath),
  };
}

let app: FastifyInstance;
if (httpsOptions) {
  app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' }, https: httpsOptions as any });
} else {
  app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });
}

// Read-only guard: block non-GET methods when READONLY=true
const READONLY = String(process.env.READONLY || 'false').toLowerCase() === 'true';
app.addHook('onRequest', async (req: FastifyRequest, reply: FastifyReply) => {
  if (READONLY && req.method !== 'GET') {
    return reply.code(403).send({ error: { code: 'READ_ONLY', message: 'Server in read-only mode', details: {} } });
  }
});

app.get('/health', async (_req: FastifyRequest, _reply: FastifyReply) => ({ status: 'ok', uptime_s: Math.round(process.uptime()) }));

// Expose version info
app.get('/version', async (_req: FastifyRequest, _reply: FastifyReply) => {
  try {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    return { app: pkg.name ?? 'project-agent', version: pkg.version ?? '0.0.0', schema: '2025-09-01' };
  } catch {
    return { app: 'project-agent', version: '0.0.0', schema: '2025-09-01' };
  }
});

const port = Number(process.env.PORT || 7777);
app.listen({ port, host: '127.0.0.1' })
  .then(() => {
    app.log.info({ port }, 'server started');
  })
  .catch((err) => {
    app.log.error({ err }, 'failed to start');
    process.exit(1);
  });
