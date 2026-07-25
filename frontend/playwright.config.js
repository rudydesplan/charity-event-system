import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "@playwright/test";

import { e2eDatabasePath } from "./e2e/database-path.js";


const frontendDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(frontendDirectory, "..");


export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  globalTeardown: "./e2e/global-teardown.js",
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      name: "API",
      command:
        'venv/bin/gunicorn --bind 127.0.0.1:5000 "app:create_app()"',
      cwd: projectRoot,
      env: {
        ...process.env,
        DATABASE_PATH: e2eDatabasePath,
      },
      url: "http://127.0.0.1:5000/api/health",
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGTERM", timeout: 500 },
      timeout: 60_000,
    },
    {
      name: "Frontend",
      command: "npm run dev",
      cwd: frontendDirectory,
      url: "http://localhost:5173",
      reuseExistingServer: false,
      gracefulShutdown: { signal: "SIGINT", timeout: 500 },
      timeout: 60_000,
    },
  ],
});
