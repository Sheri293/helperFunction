import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

const CONFIG = {
  MIN_NODE_VERSION: 18,
  REQUIRED_DIRS: ["tests", "src", "reports"],
  SEPARATOR: "=".repeat(60),
};

const STATUS = {
  PASS: "PASS",
  FAIL: "FAIL",
  WARN: "WARN",
};

const ICONS = {
  [STATUS.PASS]: "✅",
  [STATUS.FAIL]: "❌",
  [STATUS.WARN]: "⚠️",
};

const createCheck = (name, status, message) => ({ name, status, message });

const checkNodeVersion = async () => {
  try {
    const { stdout } = await execAsync("node --version");
    const version = stdout.trim();
    const majorVersion = parseInt(version.substring(1).split(".")[0]);
    const isValid = majorVersion >= CONFIG.MIN_NODE_VERSION;

    return createCheck(
      "Node.js Version",
      isValid ? STATUS.PASS : STATUS.FAIL,
      `${version} ${
        isValid
          ? `(>= ${CONFIG.MIN_NODE_VERSION}.0.0)`
          : `(< ${CONFIG.MIN_NODE_VERSION}.0.0)`
      }`
    );
  } catch (error) {
    return createCheck("Node.js Version", STATUS.FAIL, "Node.js not found");
  }
};

const checkNpm = async () => {
  try {
    const { stdout } = await execAsync("npm --version");
    return createCheck("npm", STATUS.PASS, `${stdout.trim()} Available`);
  } catch (error) {
    return createCheck("npm", STATUS.FAIL, "npm not found");
  }
};

const checkPlaywright = async () => {
  try {
    const { stdout } = await execAsync("npx playwright --version");
    return createCheck("Playwright", STATUS.PASS, `${stdout.trim()} Installed`);
  } catch (error) {
    return createCheck("Playwright", STATUS.FAIL, "Playwright not installed");
  }
};

const checkDirectories = () => {
  return CONFIG.REQUIRED_DIRS.map((dir) => {
    const exists = fs.existsSync(dir);
    return createCheck(
      `Directory: ${dir}`,
      exists ? STATUS.PASS : STATUS.FAIL,
      exists ? "Exists" : "Missing"
    );
  });
};

const checkEnvironment = () => {
  const exists = fs.existsSync(".env");
  return createCheck(
    ".env Configuration",
    exists ? STATUS.PASS : STATUS.WARN,
    exists ? "Found" : "Not found"
  );
};

const displayResults = (checks) => {
  console.log("Setup Validation Results:");
  console.log(CONFIG.SEPARATOR);

  checks.forEach((check) => {
    const statusIcon = ICONS[check.status];
    console.log(`${statusIcon} ${check.name.padEnd(25)} ${check.message}`);
  });

  console.log(CONFIG.SEPARATOR);
};

const evaluateResults = (checks) => {
  const failures = checks.filter(
    (check) => check.status === STATUS.FAIL
  ).length;
  const warnings = checks.filter(
    (check) => check.status === STATUS.WARN
  ).length;

  if (failures > 0) {
    console.log(
      `Setup validation failed: ${failures} failures, ${warnings} warnings`
    );
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`Setup validation passed with warnings: ${warnings} warnings`);
  } else {
    console.log("Setup validation passed successfully!");
  }
};

async function validateSetup() {
  console.log("Validating test environment setup...");

  const checks = [
    await checkNodeVersion(),
    await checkNpm(),
    await checkPlaywright(),
    ...checkDirectories(),
    checkEnvironment(),
  ];

  displayResults(checks);
  evaluateResults(checks);
}

validateSetup();
