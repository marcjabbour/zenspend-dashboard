import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const categories = sqliteTable('categories', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  weeklyBudget: real('weekly_budget').notNull().default(0),
  period: text('period', { enum: ['weekly', 'monthly'] }).notNull().default('weekly'),
  color: text('color').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  amount: real('amount').notNull(),
  categoryId: text('category_id'),
  description: text('description').notNull(),
  type: text('type', { enum: ['expense', 'income', 'cc_payment'] }).notNull(),
  isFixed: integer('is_fixed', { mode: 'boolean' }).notNull().default(false),
  groupId: text('group_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey().default(1),
  monthlyIncome: real('monthly_income').notNull().default(8000),
  currency: text('currency').notNull().default('$'),
  showFixedCosts: integer('show_fixed_costs', { mode: 'boolean' }).notNull().default(true),
  checkingBalance: real('checking_balance').notNull().default(0),
  creditCardBalance: real('credit_card_balance').notNull().default(0),
  balanceAsOf: text('balance_as_of').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// Type exports for use in routes
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Settings = typeof settings.$inferSelect;
