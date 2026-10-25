#!/usr/bin/env bun
/**
 * CLI script to seed development database with demo data matching the PWA.
 * Usage:
 *   bun run scripts/seed.ts
 */
import { neon, Pool } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { drizzle as drizzleHttp } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePool } from 'drizzle-orm/neon-serverless';
import { schema } from '../src/db/client';
import { findSeededGroup, seedBaseData, seedDemoTransactions } from '../src/db/seed';

config({ path: '.dev.vars' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not defined in .dev.vars or environment');
  process.exit(1);
}

console.log('🌱 Connecting to database...');

async function main() {
  const readDb = drizzleHttp(neon(databaseUrl), { schema });
  const existingGroupId = await findSeededGroup(readDb as any, 'Lakshi Group');

  if (existingGroupId) {
    console.log(`ℹ️ "Lakshi Group" already exists in database (id: ${existingGroupId}). Skipping seed.`);
    return;
  }

  console.log('Seeding Lakshi Group, 12 members, 5 loan shapes, current cycle and operator account...');
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const txDb = drizzlePool(pool, { schema });
    const base = await seedBaseData(txDb as any, {
      groupName: 'Lakshi Group',
      username: 'lakshigroup',
      password: 'lakshigroup', // Default PWA credentials
    });

    console.log(`✓ Created group ${base.groupId} and operator user (username: "lakshigroup", password: "lakshigroup")`);

    console.log('Seeding demo transactions (4 meeting deposits, 2 active loans, 2 repayments)...');
    await seedDemoTransactions(txDb as any, base);
    console.log('✓ Demo transactions seeded successfully!');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
