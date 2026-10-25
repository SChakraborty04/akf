#!/usr/bin/env bun
/**
 * CLI script to seed database with production/demo data matching the PWA and MIS.
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
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const txDb = drizzlePool(pool, { schema });

    console.log('Ensuring admin credentials (username: "admin" / "super_admin", password: "Admin123"), system settings, and locations...');
    const base = await seedBaseData(txDb as any, {
      groupName: 'Lakshi Group',
      username: 'lakshigroup',
      password: 'lakshigroup',
      adminPassword: 'Admin123',
    });
    console.log('✓ Admin accounts configured with default password: "Admin123"');

    const existingGroupId = await findSeededGroup(readDb as any, 'Lakshi Group');
    if (existingGroupId && base.groupId !== existingGroupId) {
      console.log(`ℹ️ "Lakshi Group" already exists in database (id: ${existingGroupId}).`);
    } else {
      console.log(`✓ Created/verified group ${base.groupId} and operator user (username: "lakshigroup", password: "lakshigroup")`);
      console.log('Seeding demo transactions (meeting deposits, active loans, repayments)...');
      await seedDemoTransactions(txDb as any, base);
      console.log('✓ Demo transactions seeded successfully!');
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error seeding database:', err);
  process.exit(1);
});
