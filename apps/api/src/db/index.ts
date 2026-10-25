import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import * as relations from "@/db/relation";

// Transaction pooler connection on port 6543 requires prepare: false
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client, {
  schema: { ...schema, ...relations },
});

export type Database = typeof db;
