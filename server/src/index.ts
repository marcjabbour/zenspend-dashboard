import Fastify from 'fastify';
import cors from '@fastify/cors';
import { categoriesRoutes } from './routes/categories.js';
import { transactionsRoutes } from './routes/transactions.js';
import { settingsRoutes } from './routes/settings.js';
import { migrateRoutes } from './routes/migrate.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const fastify = Fastify({
  logger: true,
});

// Register CORS
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

// Health check
fastify.get('/api/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Register routes
fastify.register(categoriesRoutes, { prefix: '/api' });
fastify.register(transactionsRoutes, { prefix: '/api' });
fastify.register(settingsRoutes, { prefix: '/api' });
fastify.register(migrateRoutes, { prefix: '/api' });

// Start server
try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server listening on http://localhost:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
