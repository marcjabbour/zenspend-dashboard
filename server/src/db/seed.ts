import { db, schema } from './index.js';
import { eq } from 'drizzle-orm';

const DEFAULT_CATEGORIES = [
  { id: 'groceries', name: 'Groceries', weeklyBudget: 800, period: 'weekly' as const, color: '#10b981' },
  { id: 'outings', name: 'Outings', weeklyBudget: 1000, period: 'weekly' as const, color: '#3b82f6' },
  { id: 'misc', name: 'Misc', weeklyBudget: 200, period: 'weekly' as const, color: '#6366f1' },
];

async function seed() {
  console.log('Seeding database...');

  // Check if categories already exist
  const existingCategories = db.select().from(schema.categories).all();

  if (existingCategories.length === 0) {
    for (const category of DEFAULT_CATEGORIES) {
      db.insert(schema.categories).values(category).run();
      console.log(`Created category: ${category.name}`);
    }
  } else {
    console.log('Categories already exist, skipping seed');
  }

  // Ensure settings exist
  const existingSettings = db.select().from(schema.settings).where(eq(schema.settings.id, 1)).get();

  if (!existingSettings) {
    db.insert(schema.settings).values({
      id: 1,
      monthlyIncome: 8000,
      currency: '$',
      showFixedCosts: true,
      checkingBalance: 0,
      creditCardBalance: 0,
      balanceAsOf: new Date().toISOString(),
    }).run();
    console.log('Created default settings');
  }

  console.log('Seeding completed!');
}

seed();
