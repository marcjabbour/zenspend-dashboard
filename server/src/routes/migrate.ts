import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const categorySchema = z.object({
  id: z.string(),
  name: z.string(),
  weeklyBudget: z.number(),
  period: z.enum(['weekly', 'monthly']),
  color: z.string(),
});

const transactionSchema = z.object({
  id: z.string(),
  date: z.string(),
  amount: z.number(),
  categoryId: z.string(),
  description: z.string(),
  type: z.enum(['expense', 'income', 'cc_payment']),
  isFixed: z.boolean().optional(),
  groupId: z.string().optional(),
});

const settingsSchema = z.object({
  monthlyIncome: z.number(),
  currency: z.string(),
  showFixedCosts: z.boolean(),
  checkingBalance: z.number().optional(),
  creditCardBalance: z.number().optional(),
  balanceAsOf: z.string().optional(),
});

const importSchema = z.object({
  categories: z.array(categorySchema),
  transactions: z.array(transactionSchema),
  settings: settingsSchema,
});

export async function migrateRoutes(fastify: FastifyInstance) {
  // POST /api/migrate/import - Import data from localStorage export
  fastify.post<{ Body: z.infer<typeof importSchema> }>('/migrate/import', async (request, reply) => {
    const parseResult = importSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid import data', details: parseResult.error.errors },
      });
    }

    const { categories, transactions, settings } = parseResult.data;

    let categoriesImported = 0;
    let transactionsImported = 0;

    // Import categories
    for (const category of categories) {
      const existing = db.select().from(schema.categories).where(eq(schema.categories.id, category.id)).get();
      if (!existing) {
        db.insert(schema.categories).values(category).run();
        categoriesImported++;
      }
    }

    // Import transactions
    for (const transaction of transactions) {
      const existing = db.select().from(schema.transactions).where(eq(schema.transactions.id, transaction.id)).get();
      if (!existing) {
        db.insert(schema.transactions).values({
          ...transaction,
          categoryId: transaction.categoryId || null,
          groupId: transaction.groupId || null,
          isFixed: transaction.isFixed || false,
        }).run();
        transactionsImported++;
      }
    }

    // Update settings
    const existingSettings = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();
    if (existingSettings) {
      db.update(schema.settings)
        .set({
          monthlyIncome: settings.monthlyIncome,
          currency: settings.currency,
          showFixedCosts: settings.showFixedCosts,
          checkingBalance: settings.checkingBalance || 0,
          creditCardBalance: settings.creditCardBalance || 0,
          balanceAsOf: settings.balanceAsOf || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.settings.id, 1))
        .run();
    } else {
      db.insert(schema.settings).values({
        id: 1,
        monthlyIncome: settings.monthlyIncome,
        currency: settings.currency,
        showFixedCosts: settings.showFixedCosts,
        checkingBalance: settings.checkingBalance || 0,
        creditCardBalance: settings.creditCardBalance || 0,
        balanceAsOf: settings.balanceAsOf || new Date().toISOString(),
      }).run();
    }

    return {
      success: true,
      data: {
        categoriesImported,
        transactionsImported,
        settingsUpdated: true,
      },
    };
  });

  // GET /api/migrate/export - Export all data (useful for backup)
  fastify.get('/migrate/export', async () => {
    const categories = db.select().from(schema.categories).all();
    const transactions = db.select().from(schema.transactions).all();
    const settings = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();

    return {
      success: true,
      data: {
        categories,
        transactions,
        settings,
        exportedAt: new Date().toISOString(),
      },
    };
  });
}
