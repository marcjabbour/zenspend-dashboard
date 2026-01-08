import { FastifyInstance } from 'fastify';
import { db, schema } from '../db/index.js';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const categorySchema = z.object({
  name: z.string().min(1),
  weeklyBudget: z.number().min(0),
  period: z.enum(['weekly', 'monthly']),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

const categoryUpdateSchema = categorySchema.partial();

export async function categoriesRoutes(fastify: FastifyInstance) {
  // GET /api/categories - List all categories
  fastify.get('/categories', async () => {
    const categories = db.select().from(schema.categories).all();
    return { success: true, data: categories };
  });

  // GET /api/categories/:id - Get single category
  fastify.get<{ Params: { id: string } }>('/categories/:id', async (request, reply) => {
    const { id } = request.params;
    const category = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();

    if (!category) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    }

    return { success: true, data: category };
  });

  // POST /api/categories - Create category
  fastify.post<{ Body: z.infer<typeof categorySchema> }>('/categories', async (request, reply) => {
    const parseResult = categorySchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid category data', details: parseResult.error.errors },
      });
    }

    const id = crypto.randomUUID();
    const newCategory = { id, ...parseResult.data };

    db.insert(schema.categories).values(newCategory).run();

    const created = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
    return reply.status(201).send({ success: true, data: created });
  });

  // PUT /api/categories/:id - Update category
  fastify.put<{ Params: { id: string }; Body: z.infer<typeof categoryUpdateSchema> }>('/categories/:id', async (request, reply) => {
    const { id } = request.params;
    const parseResult = categoryUpdateSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid category data', details: parseResult.error.errors },
      });
    }

    const existing = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
    if (!existing) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    }

    db.update(schema.categories)
      .set({ ...parseResult.data, updatedAt: new Date().toISOString() })
      .where(eq(schema.categories.id, id))
      .run();

    const updated = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
    return { success: true, data: updated };
  });

  // DELETE /api/categories/:id - Delete category
  fastify.delete<{ Params: { id: string } }>('/categories/:id', async (request, reply) => {
    const { id } = request.params;

    const existing = db.select().from(schema.categories).where(eq(schema.categories.id, id)).get();
    if (!existing) {
      return reply.status(404).send({ success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } });
    }

    db.delete(schema.categories).where(eq(schema.categories.id, id)).run();

    return { success: true, data: { deleted: true } };
  });
}
