import type { Platform } from '@sveltejs/kit';

declare global {
  namespace App {
    interface Locals {
      admin?: {
        sub: string;
        masjid_id: string;
        email: string;
        display_name: string | null;
      };
    }
    interface Platform {
      env: {
        DB: D1Database;
        CACHE: KVNamespace;
        JWT_SECRET: string;
        ENVIRONMENT: string;
      };
      context: {
        waitUntil(promise: Promise<unknown>): void;
      };
    }
  }
}

export {};