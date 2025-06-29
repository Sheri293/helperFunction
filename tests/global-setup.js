import { mkdirSync, existsSync } from "fs";

export default async function globalSetup() {
  console.log("🔧 Setting up test environment...");

  ["test-results", "reports", "logs"].forEach((dir) => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  console.log(" Global setup completed");
}
