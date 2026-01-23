
import { JsonAdapter } from './json-adapter';
import { PostgresAdapter } from './postgres-adapter';

// ------------------------------------------------------------------
// 🧠 SMART ADAPTER: The brain of the operation
// ------------------------------------------------------------------
// 1. Detects Mode: Lite (File) vs Pro (SQL)
// 2. Returns uniform API so the UI code never knows the difference
// ------------------------------------------------------------------

const useExternalDB = !!process.env.DATABASE_URL;

console.log(`[SmartDB] Initializing in ${useExternalDB ? '🏗️ PRO (Postgres)' : '⚡ LITE (JSON)'} mode`);

export const db = useExternalDB
    ? new PostgresAdapter(process.env.DATABASE_URL!)
    : new JsonAdapter();

// Type definition for IntelliSense
export type SmartDB = JsonAdapter | PostgresAdapter;
