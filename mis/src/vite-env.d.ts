/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Root API URL (e.g. "https://api.yourdomain.com" or "http://localhost:8787")
   * The client will automatically append /admin if needed.
   */
  readonly VITE_API_URL?: string;
  /**
   * Optional full admin API URL override (e.g. "https://api.yourdomain.com/admin")
   */
  readonly VITE_ADMIN_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
