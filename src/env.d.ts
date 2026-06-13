/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** The authenticated user, or null if not signed in. */
    user: import('./lib/types').User | null;
  }
}

interface ImportMetaEnv {
  readonly SESSION_SECRET?: string;
  readonly RESEND_API_KEY?: string;
  readonly EMAIL_RECEPTOR?: string;
  readonly KV_REST_API_URL?: string;
  readonly KV_REST_API_TOKEN?: string;
  readonly CULQI_PUBLIC_KEY?: string;
  readonly CULQI_SECRET_KEY?: string;
  readonly CULQI_WEBHOOK_SECRET?: string;
  readonly CULQI_ENV?: 'test' | 'production';
  readonly GOOGLE_CLIENT_ID?: string;
  readonly GOOGLE_CLIENT_SECRET?: string;
  readonly GOOGLE_REDIRECT_URI?: string;
  readonly ADMIN_KEY?: string;
  readonly ADMIN_USER?: string;
  readonly ADMIN_PASS?: string;
  readonly PUBLIC_GTM_ID?: string;
  readonly PUBLIC_META_PIXEL_ID?: string;
  readonly PUBLIC_CULQI_PUBLIC_KEY?: string;
  readonly PUBLIC_CULQI_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
