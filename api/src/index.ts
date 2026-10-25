import { createApp } from './app';

// Cloudflare Workers entry point (user-facing API used by the PWA).
// The future admin API lives in ../admin and reuses ./db/schema.
export default createApp();
