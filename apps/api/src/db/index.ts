import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Transaction pooler connection on port 6543 requires prepare: false
const client = postgres(process.env.DATABASE_URL!, { prepare: false });

export const db = drizzle(client);
