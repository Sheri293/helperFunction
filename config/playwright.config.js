import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const isCI = Boolean(process.env.CI);
const testsPath = resolve(__dirname, "../tests");
const outputPath = "../test-results";

const reporterConfig = [
  ["html", { outputFolder: `${outputPath}/html-report` }],
  ["json", { outputFile: `${outputPath}/results.json` }],
  ["junit", { outputFile: `${outputPath}/results.xml` }],
  ["list"],
];

const projectsConfig = [
  {
    name: "Simple Functions",
    testMatch: "**/checkout-simple.test.js",
  },
  {
    name: "Complex Functions",
    testMatch: "**/complex-functions.test.js",
  },
];

export default defineConfig({
  testDir: testsPath,
  fullyParallel: true,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: reporterConfig,
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: projectsConfig,
  globalSetup: resolve(testsPath, "global-setup.js"),
  globalTeardown: resolve(testsPath, "global-teardown.js"),
});
