import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';

const transactionSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  categoryId: z.string().nullable().optional(),
  description: z.string().min(1),
  type: z.enum(['expense', 'income', 'cc_payment']),
  isFixed: z.boolean().optional().default(false),
  groupId: z.string().nullable().optional(),
});

const transactionUpdateSchema = transactionSchema.partial();

const recurringRequestSchema = z.object({
  base: transactionSchema,
  months: z.number().int().min(1).max(24).default(12),
});

const groupUpdateSchema = z.object({
  updates: transactionUpdateSchema,
  scope: z.enum(['all', 'future']),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function transactionsRoutes(fastify: FastifyInstance) {
  // GET /api/transactions - List transactions with optional filters
  fastify.get<{
    Querystring: {
      startDate?: string;
      endDate?: string;
      categoryId?: string;
      type?: 'expense' | 'income' | 'cc_payment';
      isFixed?: string;
    };
  }>('/transactions', async (request) => {
    const { startDate, endDate, categoryId, type, isFixed } = request.query;

    let query = db.select().from(schema.transactions);
    const conditions = [];

    if (startDate) {
      conditions.push(gte(schema.transactions.date, startDate));
    }
    if (endDate) {
      conditions.push(lte(schema.transactions.date, endDate));
    }
    if (categoryId) {
      conditions.push(eq(schema.transactions.categoryId, categoryId));
    }
    if (type) {
      conditions.push(eq(schema.transactions.type, type));
    }
    if (isFixed !== undefined) {
      conditions.push(eq(schema.transactions.isFixed, isFixed === 'true'));
    }

    const transactions = conditions.length > 0
      ? db.select().from(schema.transactions).where(and(...conditions)).all()
      : db.select().from(schema.transactions).all();

    return { success: true, data: transactions };
  });

  // GET /api/transactions/:id - Get single transaction
  fastify.get<{ Params: { id: string } }>('/transactions/:id', async (request, reply) => {
    const { id } = request.params;
    const transaction = db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).get();

    if (!transaction) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
    }

    return { success: true, data: transaction };
  });

  // POST /api/transactions - Create single transaction
  fastify.post<{ Body: z.infer<typeof transactionSchema> }>('/transactions', async (request, reply) => {
    const parseResult = transactionSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid transaction data', details: parseResult.error.errors },
      });
    }

    const id = crypto.randomUUID();
    const newTransaction = {
      id,
      ...parseResult.data,
      categoryId: parseResult.data.categoryId || null,
      groupId: parseResult.data.groupId || null,
    };

    db.insert(schema.transactions).values(newTransaction).run();

    const created = db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).get();
    return reply.status(201).send({ success: true, data: created });
  });

  // POST /api/transactions/recurring - Create recurring transactions (12-month by default)
  fastify.post<{ Body: z.infer<typeof recurringRequestSchema> }>('/transactions/recurring', async (request, reply) => {
    const parseResult = recurringRequestSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid recurring transaction data', details: parseResult.error.errors },
      });
    }

    const { base, months } = parseResult.data;
    const groupId = crypto.randomUUID();
    const baseDate = new Date(base.date + 'T00:00:00');
    const baseDay = baseDate.getDate();
    const createdTransactions: schema.Transaction[] = [];

    for (let i = 0; i < months; i++) {
      const targetYear = baseDate.getFullYear();
      const targetMonth = baseDate.getMonth() + i;

      // Get the last day of the target month to handle short months (Feb, Apr, etc.)
      const lastDayOfMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

      // Use the base day, but clamp to the last day if the month is shorter
      // e.g., 31st becomes 28th in February, 30th in April
      const actualDay = Math.min(baseDay, lastDayOfMonth);
      const projectDate = new Date(targetYear, targetMonth, actualDay);

      const id = crypto.randomUUID();

      const transaction = {
        id,
        ...base,
        date: projectDate.toISOString().split('T')[0],
        categoryId: base.categoryId || null,
        groupId,
        isFixed: true,
      };

      db.insert(schema.transactions).values(transaction).run();
      const created = db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).get();
      if (created) createdTransactions.push(created);
    }

    return reply.status(201).send({ success: true, data: createdTransactions });
  });

  // PUT /api/transactions/:id - Update single transaction
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof transactionUpdateSchema> }>('/transactions/:id', async (request, reply) => {
    const { id } = request.params;
    const parseResult = transactionUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid transaction data', details: parseResult.error.errors },
      });
    }

    const existing = db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).get();
    if (!existing) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
    }

    db.update(schema.transactions)
      .set({ ...parseResult.data, updatedAt: new Date().toISOString() })
      .where(eq(schema.transactions.id, id))
      .run();

    const updated = db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).get();
    return { success: true, data: updated };
  });

  // PUT /api/transactions/group/:groupId - Update recurring group
  fastify.put<{ Params: { groupId: string }; Body: z.infer<typeof groupUpdateSchema> }>('/transactions/group/:groupId', async (request, reply) => {
    const { groupId } = request.params;
    const parseResult = groupUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid update data', details: parseResult.error.errors },
      });
    }

    const { updates, scope, fromDate } = parseResult.data;

    // Get all transactions in the group
    const groupTransactions = db.select().from(schema.transactions).where(eq(schema.transactions.groupId, groupId)).all();

    if (groupTransactions.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction group not found' } });
    }

    // Filter based on scope
    const toUpdate = scope === 'all'
      ? groupTransactions
      : groupTransactions.filter(t => fromDate && t.date >= fromDate);

    for (const tx of toUpdate) {
      db.update(schema.transactions)
        .set({ ...updates, date: tx.date, updatedAt: new Date().toISOString() })
        .where(eq(schema.transactions.id, tx.id))
        .run();
    }

    const updatedTransactions = db.select().from(schema.transactions).where(eq(schema.transactions.groupId, groupId)).all();
    return { success: true, data: updatedTransactions };
  });

  // DELETE /api/transactions/:id - Delete single transaction
  fastify.delete<{ Params: { id: string } }>('/transactions/:id', async (request, reply) => {
    const { id } = request.params;

    const existing = db.select().from(schema.transactions).where(eq(schema.transactions.id, id)).get();
    if (!existing) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction not found' } });
    }

    db.delete(schema.transactions).where(eq(schema.transactions.id, id)).run();

    return { success: true, data: { deleted: true } };
  });

  // DELETE /api/transactions/group/:groupId - Delete recurring group
  fastify.delete<{
    Params: { groupId: string };
    Querystring: { scope?: 'all' | 'future'; fromDate?: string };
  }>('/transactions/group/:groupId', async (request, reply) => {
    const { groupId } = request.params;
    const { scope = 'all', fromDate } = request.query;

    const groupTransactions = db.select().from(schema.transactions).where(eq(schema.transactions.groupId, groupId)).all();

    if (groupTransactions.length === 0) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Transaction group not found' } });
    }

    let deletedCount = 0;

    if (scope === 'all') {
      db.delete(schema.transactions).where(eq(schema.transactions.groupId, groupId)).run();
      deletedCount = groupTransactions.length;
    } else if (fromDate) {
      const toDelete = groupTransactions.filter(t => t.date >= fromDate);
      for (const tx of toDelete) {
        db.delete(schema.transactions).where(eq(schema.transactions.id, tx.id)).run();
        deletedCount++;
      }
    }

    return { success: true, data: { deleted: deletedCount } };
  });
}
