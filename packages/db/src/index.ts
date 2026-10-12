import { env } from "@sweettreats/env/server";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema";

export { schema };

export function createDb() {
  return drizzle(env.DB, { schema });
}
