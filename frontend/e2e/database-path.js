import os from "node:os";
import path from "node:path";


export const e2eDatabasePath = path.join(
  os.tmpdir(),
  `goodrun-event-registration-e2e-${process.pid}.db`,
);
