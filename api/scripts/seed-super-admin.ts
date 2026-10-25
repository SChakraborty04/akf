import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import { eq } from 'drizzle-orm';
import { schema } from '../src/db/client';
import { users } from '../src/db/schema';
import { hashPassword } from '../src/lib/password';

config({ path: '.dev.vars' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL not set in .dev.vars');
  process.exit(1);
}

async function main() {
  const db = drizzle(neon(databaseUrl), { schema });
  const username = 'super_admin';
  const password = 'Admin123';
  const passwordHash = await hashPassword(password);

  console.log(`Checking user "${username}" in database...`);
  const [existing] = await db.select().from(users).where(eq(users.username, username)).limit(1);

  if (existing) {
    console.log(`User "${username}" exists. Updating password and ensuring super_admin role...`);
    await db
      .update(users)
      .set({
        passwordHash,
        role: 'super_admin',
        isActive: true,
        lockedUntil: null,
        failedLoginCount: 0,
        fullName: 'Global Super Administrator',
      })
      .where(eq(users.id, existing.id));
    console.log(`✓ User "${username}" successfully updated with password "${password}"!`);
  } else {
    console.log(`Creating user "${username}" with role super_admin...`);
    const [inserted] = await db
      .insert(users)
      .values({
        username,
        passwordHash,
        fullName: 'Global Super Administrator',
        role: 'super_admin',
        language: 'en',
        isActive: true,
        groupId: null,
      })
      .returning();
    console.log(`✓ User "${username}" successfully created with id: ${inserted.id}!`);
  }

  // Also verify 'admin' user with Admin123 as well for convenience
  const [existingAdmin] = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
  if (existingAdmin) {
    await db
      .update(users)
      .set({
        passwordHash,
        role: 'super_admin',
        isActive: true,
        lockedUntil: null,
        failedLoginCount: 0,
      })
      .where(eq(users.id, existingAdmin.id));
    console.log(`✓ User "admin" password updated to "Admin123" as well.`);
  }
}

main().catch((err) => {
  console.error('Failed to create/update super_admin:', err);
  process.exit(1);
});
