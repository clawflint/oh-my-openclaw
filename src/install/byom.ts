#!/usr/bin/env bun
/**
 * BYOM (Bring Your Own Machine) Installation Script
 * Installs OmOC on customer's own VPS/server
 */

import { execSync } from "child_process";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

interface InstallOptions {
  workspaceId: string;
  joinToken: string;
  apiUrl: string;
  installDir?: string;
}

const INSTALL_DIR = process.env.OMOC_INSTALL_DIR || "/opt/clawflint";
const SERVICE_NAME = "clawflint-omoc";

function printBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   oh-my-openclaw (OmOC) - BYOM Installation              ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
}

function checkPrerequisites(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const bunVersion = execSync("bun --version", { encoding: "utf8" }).trim();
    console.log(`✓ Bun ${bunVersion} detected`);
  } catch {
    errors.push("Bun is not installed. Install from https://bun.sh");
  }

  try {
    const gitVersion = execSync("git --version", { encoding: "utf8" }).trim();
    console.log(`✓ ${gitVersion}`);
  } catch {
    errors.push("Git is not installed");
  }

  try {
    execSync("docker --version", { stdio: "ignore" });
    console.log("✓ Docker detected (optional)");
  } catch {
    console.log("⚠ Docker not found (optional but recommended)");
  }

  return { ok: errors.length === 0, errors };
}

function createDirectories(installDir: string) {
  console.log(`\n📁 Creating directories in ${installDir}...`);

  const dirs = [
    installDir,
    join(installDir, "data"),
    join(installDir, "logs"),
    join(installDir, "config"),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  console.log("✓ Directories created");
}

async function downloadWorker(options: InstallOptions, installDir: string): Promise<string> {
  console.log("\n📥 Downloading ClawFlint worker...");

  const binDir = join(installDir, "bin");
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  const outputPath = join(binDir, "clawflint-worker");
  const localBinaryPath = process.env.CLAWFLINT_WORKER_BINARY_PATH;
  if (localBinaryPath) {
    copyFileSync(localBinaryPath, outputPath);
    chmodSync(outputPath, 0o755);
    console.log(`✓ Worker copied from local binary: ${localBinaryPath}`);
    return outputPath;
  }

  const downloadUrl = process.env.CLAWFLINT_WORKER_BINARY_URL ||
    `${options.apiUrl.replace(/\/$/, "")}/internal/workers/byom/binary`;

  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${options.joinToken}`,
      "X-Workspace-Id": options.workspaceId,
    },
  });

  if (!response.ok) {
    throw new Error(`Worker download failed: ${response.status} ${response.statusText}`);
  }

  const binary = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, binary);
  chmodSync(outputPath, 0o755);

  console.log(`✓ Worker downloaded to ${outputPath}`);
  return outputPath;
}

function createConfig(options: InstallOptions, installDir: string) {
  console.log("\n⚙️  Creating configuration...");

  const config = {
    workspaceId: options.workspaceId,
    joinToken: options.joinToken,
    apiUrl: options.apiUrl,
    workerType: "byom",
    dataDir: join(installDir, "data"),
    logDir: join(installDir, "logs"),
  };

  writeFileSync(
    join(installDir, "config", "worker.json"),
    JSON.stringify(config, null, 2),
  );

  console.log("✓ Configuration saved");
}

function createSystemdService(installDir: string) {
  console.log("\n🔧 Creating systemd service...");

  const serviceContent = `[Unit]
Description=ClawFlint OmOC Worker
After=network.target

[Service]
Type=simple
User=clawflint
WorkingDirectory=${installDir}
ExecStart=${INSTALL_DIR}/bin/clawflint-worker
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=CLAWFLINT_DATA_DIR=${installDir}/data

[Install]
WantedBy=multi-user.target
`;

  try {
    writeFileSync(
      `/etc/systemd/system/${SERVICE_NAME}.service`,
      serviceContent,
    );
    console.log("✓ Systemd service created");
    console.log(`  Run: sudo systemctl enable ${SERVICE_NAME}`);
    console.log(`  Run: sudo systemctl start ${SERVICE_NAME}`);
  } catch {
    const fallbackPath = join(installDir, `${SERVICE_NAME}.service`);
    writeFileSync(fallbackPath, serviceContent);
    console.log("⚠ Could not create systemd service (requires root)");
    console.log(
      "  Service file saved to:",
      fallbackPath,
    );
  }
}

function printNextSteps(installDir: string) {
  console.log(`
✅ Installation Complete!

Next Steps:
-----------
1. Review configuration: ${join(installDir, "config", "worker.json")}

2. Start the worker:
   sudo systemctl start ${SERVICE_NAME}
   
   Or manually:
   cd ${installDir} && ./bin/clawflint-worker

3. Check status in ClawFlint dashboard

4. View logs:
   sudo journalctl -u ${SERVICE_NAME} -f
   
Support:
--------
- Documentation: https://docs.clawflint.com
- Support: support@clawflint.com
`);
}

export async function runByomInstaller(args: string[] = process.argv.slice(2)) {
  printBanner();

  const workspaceId =
    args.find((a) => a.startsWith("--workspace="))?.split("=")[1] ||
    process.env.CLAWFLINT_WORKSPACE_ID;
  const joinToken =
    args.find((a) => a.startsWith("--token="))?.split("=")[1] ||
    process.env.CLAWFLINT_JOIN_TOKEN;
  const apiUrl =
    args.find((a) => a.startsWith("--api="))?.split("=")[1] ||
    process.env.CLAWFLINT_API_URL ||
    "https://api.clawflint.com";

  if (!workspaceId || !joinToken) {
    console.error("❌ Error: Workspace ID and join token are required");
    console.error("\nUsage:");
    console.error(
      "  bun install-byom.ts --workspace=<id> --token=<token> [--api=<url>]",
    );
    console.error("\nOr set environment variables:");
    console.error(
      "  CLAWFLINT_WORKSPACE_ID=<id> CLAWFLINT_JOIN_TOKEN=<token> bun install-byom.ts",
    );
    process.exit(1);
  }

  console.log("Configuration:");
  console.log(`  Workspace: ${workspaceId}`);
  console.log(`  API URL: ${apiUrl}`);
  console.log(`  Install Dir: ${INSTALL_DIR}\n`);

  const prereqs = checkPrerequisites();
  if (!prereqs.ok) {
    console.error("\n❌ Prerequisites not met:");
    prereqs.errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  const options: InstallOptions = {
    workspaceId,
    joinToken,
    apiUrl,
    installDir: INSTALL_DIR,
  };

  createDirectories(INSTALL_DIR);
  await downloadWorker(options, INSTALL_DIR);
  createConfig(options, INSTALL_DIR);
  createSystemdService(INSTALL_DIR);

  printNextSteps(INSTALL_DIR);
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  runByomInstaller().catch((err) => {
    console.error("❌ Installation failed:", err);
    process.exit(1);
  });
}
