import type { OmocConfig } from "../types/index.js";
import { createDefaultConfig, mergeConfig } from "../config/index.js";

export type OmocMode = "standalone" | "clawflint";

export interface ConfigProvider {
  getConfig(): Promise<OmocConfig | null>;
  getMode(): OmocMode;
}

export class StandaloneConfigProvider implements ConfigProvider {
  private configPath: string;

  constructor(basePath: string = ".omoc") {
    this.configPath = `${basePath}/config.json`;
  }

  async getConfig(): Promise<OmocConfig | null> {
    try {
      const { readFileSync, existsSync } = await import("fs");

      if (!existsSync(this.configPath)) {
        console.log("[config] No local config found, using defaults");
        return createDefaultConfig("My Project", "local");
      }

      const content = readFileSync(this.configPath, "utf-8");
      const userConfig = JSON.parse(content);

      const baseConfig = createDefaultConfig(
        userConfig.project?.name || "My Project",
        userConfig.project?.repo || "local",
      );

      return mergeConfig(userConfig, baseConfig);
    } catch (error) {
      console.error("[config] Failed to load standalone config:", error);
      return createDefaultConfig("My Project", "local");
    }
  }

  getMode(): OmocMode {
    return "standalone";
  }
}

export class ClawFlintConfigProvider implements ConfigProvider {
  private apiUrl: string;
  private credential: { keyId: string; secret: string } | null = null;

  constructor(
    apiUrl: string = process.env.CLAWFLINT_API_URL ||
      "https://api.clawflint.com",
  ) {
    this.apiUrl = apiUrl;

    const keyId = process.env.CLAWFLINT_KEY_ID;
    const secret = process.env.CLAWFLINT_KEY_SECRET;

    if (keyId && secret) {
      this.credential = { keyId, secret };
    }
  }

  async getConfig(): Promise<OmocConfig | null> {
    if (!this.credential) {
      console.log(
        "[config] No ClawFlint credentials, falling back to standalone",
      );
      return null;
    }

    const { ConfigBundleManager } =
      await import("../clawflint/config-bundle.js");
    const manager = new ConfigBundleManager();

    const bundle = await manager.fetchBundle(this.apiUrl, this.credential);

    if (!bundle) {
      return null;
    }

    const partialConfig = manager.extractOmocConfig();
    if (!partialConfig) {
      return null;
    }

    const baseConfig = createDefaultConfig("ClawFlint Project", "clawflint");
    return mergeConfig(partialConfig, baseConfig);
  }

  getMode(): OmocMode {
    return "clawflint";
  }
}

export class ConfigManager {
  private provider: ConfigProvider;
  private cachedConfig: OmocConfig | null = null;

  constructor() {
    const mode = this.detectMode();

    if (mode === "clawflint") {
      this.provider = new ClawFlintConfigProvider();
    } else {
      this.provider = new StandaloneConfigProvider();
    }
  }

  private detectMode(): OmocMode {
    if (process.env.CLAWFLINT_WORKER_ID || process.env.CLAWFLINT_KEY_ID) {
      return "clawflint";
    }
    return "standalone";
  }

  async initialize(): Promise<void> {
    this.cachedConfig = await this.provider.getConfig();

    if (!this.cachedConfig) {
      const { createDefaultConfig } = await import("../config/index.js");
      this.cachedConfig = createDefaultConfig("My Project", "local");
    }

    console.log(`[config] Initialized in ${this.provider.getMode()} mode`);
  }

  getConfig(): OmocConfig {
    if (!this.cachedConfig) {
      throw new Error("Config not initialized. Call initialize() first.");
    }
    return this.cachedConfig;
  }

  getMode(): OmocMode {
    return this.provider.getMode();
  }

  isClawFlint(): boolean {
    return this.provider.getMode() === "clawflint";
  }

  isStandalone(): boolean {
    return this.provider.getMode() === "standalone";
  }
}

export const configManager = new ConfigManager();
