import Fastify from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import dotenv from 'dotenv';
import { setupAuthRoutes } from './routes/auth';
import { setupContactRoutes } from './routes/contacts';
import { setupEnrichmentRoutes } from './routes/enrichment';
import { setupScoringRoutes } from './routes/scoring-routes';

dotenv.config();

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
      },
    },
  },
});

// Register plugins
app.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
});

app.register(fastifyJwt, {
  secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
});

// Health check endpoint
app.get('/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Setup routes
app.register(setupAuthRoutes, { prefix: '/api/v3' });
app.register(setupContactRoutes, { prefix: '/api/v3' });
app.register(setupEnrichmentRoutes, { prefix: '/api/v3' });
app.register(setupScoringRoutes, { prefix: '/api/v3' });

// Error handling
app.setErrorHandler((error, request, reply) => {
  app.log.error(error);
  reply.code(500).send({
    error: 'Internal Server Error',
    message: error.message,
  });
});

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    app.log.info(`✅ Server running at http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export default app;