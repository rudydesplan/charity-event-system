import { rm } from "node:fs/promises";

import { e2eDatabasePath } from "./database-path.js";


export default async function globalTeardown() {
  await rm(e2eDatabasePath, { force: true });
}
