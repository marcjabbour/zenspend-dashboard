import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const settingsUpdateSchema = z.object({
  monthlyIncome: z.number().min(0).optional(),
  currency: z.string().min(1).optional(),
  showFixedCosts: z.boolean().optional(),
  checkingBalance: z.number().optional(),
  creditCardBalance: z.number().optional(),
  balanceAsOf: z.string().optional(),
});

export async function settingsRoutes(fastify: FastifyInstance) {
  // GET /api/settings - Get user settings
  fastify.get('/settings', async (request, reply) => {
    let settings = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();

    // Create default settings if they don't exist
    if (!settings) {
      db.insert(schema.settings).values({
        id: 1,
        monthlyIncome: 8000,
        currency: '$',
        showFixedCosts: true,
        checkingBalance: 0,
        creditCardBalance: 0,
        balanceAsOf: new Date().toISOString(),
      }).run();
      settings = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();
    }

    return { success: true, data: settings };
  });

  // PUT /api/settings - Update settings
  fastify.put<{ Body: z.infer<typeof settingsUpdateSchema> }>('/settings', async (request, reply) => {
    const parseResult = settingsUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid settings data', details: parseResult.error.errors },
      });
    }

    // Ensure settings exist
    let settings = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();

    if (!settings) {
      db.insert(schema.settings).values({
        id: 1,
        monthlyIncome: 8000,
        currency: '$',
        showFixedCosts: true,
        checkingBalance: 0,
        creditCardBalance: 0,
        balanceAsOf: new Date().toISOString(),
      }).run();
    }

    db.update(schema.settings)
      .set({ ...parseResult.data, updatedAt: new Date().toISOString() })
      .where(eq(schema.settings.id, 1))
      .run();

    const updated = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();
    return { success: true, data: updated };
  });
}
