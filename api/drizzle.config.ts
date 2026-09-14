// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Explicitly tell dotenv to read your Cloudflare .dev.vars file
config({ path: '.dev.vars' });

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
