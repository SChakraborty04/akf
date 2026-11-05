#!/usr/bin/env bun
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { notInArray } from 'drizzle-orm';
import { schema } from '../src/db/client';
import {
  cycles,
  depositItems,
  deposits,
  groups,
  ledgerEntries,
  loans,
  loanStamps,
  members,
  refreshTokens,
  repayments,
  repaymentStamps,
  users,
} from '../src/db/schema';

config({ path: '.dev.vars' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not defined in .dev.vars');
  process.exit(1);
}

const sql = neon(databaseUrl);
const db = drizzle(sql, { schema });

async function main() {
  console.log('🧹 Cleaning all seed and transactional data from Neon PostgreSQL...');

  // 1. Transaction items & records
  console.log('Deleting repayment_stamps, repayments...');
  await db.delete(repaymentStamps);
  await db.delete(repayments);

  console.log('Deleting loan_stamps, loans...');
  await db.delete(loanStamps);
  await db.delete(loans);

  console.log('Deleting deposit_items, deposits...');
  await db.delete(depositItems);
  await db.delete(deposits);

  console.log('Deleting ledger_entries...');
  await db.delete(ledgerEntries);

  console.log('Deleting refresh_tokens...');
  await db.delete(refreshTokens);

  // 2. Members & Cycles
  console.log('Deleting members, cycles...');
  await db.delete(members);
  await db.delete(cycles);

  // 3. Operator & SHG users (preserve admin and super_admin for MIS portal login)
  console.log('Deleting non-admin users...');
  await db.delete(users).where(notInArray(users.role, ['super_admin', 'admin']));

  // 4. Groups
  console.log('Deleting groups...');
  await db.delete(groups);

  console.log('✅ All seed data removed successfully from Neon!');
  console.log('Preserved:');
  console.log('  - Admin users ("super_admin" / "admin" with "Admin123")');
  console.log('  - Locations hierarchy (State, District, Block, Panchayat)');
  console.log('  - System settings and loan shapes');
}

main().catch((err) => {
  console.error('Error cleaning seed data:', err);
  process.exit(1);
});
