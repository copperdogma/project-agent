import 'dotenv/config';
import Fastify from 'fastify';
const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

app.get('/health', async () => ({ status: 'ok', uptime_s: Math.round(process.uptime()) }));

const port = Number(process.env.PORT || 7777);
app.listen({ port, host: '127.0.0.1' })
  .then(() => {
    app.log.info({ port }, 'server started');
  })
  .catch((err) => {
    app.log.error({ err }, 'failed to start');
    process.exit(1);
  });
