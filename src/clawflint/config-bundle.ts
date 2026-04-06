import type { OmocConfig } from "../types/index.js";
import { createHmac } from "crypto";

export interface ClawFlintConfigBundle {
  configVersionId: string;
  versionNumber: number;
  openclawConfig: string;
  systemPrompt: string;
  envVars: Record<string, string>;
  onboardConfig: {
    omoc?: OmocOnboardConfig;
    tools?: string[];
    channels?: Array<{ name: string; type: string; config: unknown }>;
  } | null;
  signature: string;
}

export interface OmocOnboardConfig {
  enabled: boolean;
  teamConfig: {
    agents: Array<{
      role: string;
      enabled: boolean;
      modelTier: string;
    }>;
    defaultWorkflow: string;
    maxParallelWorkers: number;
  };
  costControls: {
    sessionBudgetUsd: number;
    taskBudgetUsd: number;
    alertThresholdPercent: number;
  };
  eventRouting: {
    channels: Record<string, string>;
  };
}

export class ConfigBundleManager {
  private currentBundle: ClawFlintConfigBundle | null = null;

  async fetchBundle(
    apiUrl: string,
    credential: { keyId: string; secret: string },
  ): Promise<ClawFlintConfigBundle | null> {
    const workerId = process.env.CLAWFLINT_WORKER_ID;

    try {
      const response = await fetch(
        `${apiUrl}/internal/workers/${workerId}/config/bundle`,
        {
          headers: {
            Authorization: `Bearer ${credential.keyId}:${credential.secret}`,
          },
        },
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log("[config] No config bundle available");
          return null;
        }
        throw new Error(`Config bundle request failed: ${response.status}`);
      }

      const payload = (await response.json()) as {
        ok: boolean;
        data?: Record<string, string>;
      };

      if (!payload.ok || !payload.data) {
        throw new Error("Invalid config bundle payload");
      }

      const { signature, ...bundle } = payload.data;

      if (!this.verifySignature(bundle, signature)) {
        throw new Error("Invalid config bundle signature");
      }

      this.currentBundle = this.parseBundle(payload.data);
      return this.currentBundle;
    } catch (error) {
      console.error("[config] Failed to fetch bundle:", error);
      return null;
    }
  }

  private parseBundle(data: Record<string, string>): ClawFlintConfigBundle {
    return {
      configVersionId: data.configVersionId,
      versionNumber: parseInt(data.versionNumber, 10),
      openclawConfig: Buffer.from(data.openclawConfig, "base64").toString(
        "utf8",
      ),
      systemPrompt: Buffer.from(data.systemPrompt, "base64").toString("utf8"),
      envVars: JSON.parse(Buffer.from(data.envVars, "base64").toString("utf8")),
      onboardConfig: data.onboardConfig
        ? JSON.parse(Buffer.from(data.onboardConfig, "base64").toString("utf8"))
        : null,
      signature: data.signature,
    };
  }

  private verifySignature(
    bundle: Record<string, unknown>,
    signature: string,
  ): boolean {
    const secret = process.env.CONFIG_BUNDLE_SIGNING_SECRET;
    const allowInsecure = process.env.OMOC_ALLOW_INSECURE_BUNDLE === "true";
    if (!secret) {
      if (allowInsecure) {
        console.warn("[config] Signature verification bypassed (OMOC_ALLOW_INSECURE_BUNDLE=true)");
        return true;
      }
      console.error("[config] Missing CONFIG_BUNDLE_SIGNING_SECRET");
      return false;
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(JSON.stringify(bundle))
      .digest("hex");

    return signature === expectedSignature;
  }

  extractOmocConfig(): Partial<OmocConfig> | null {
    if (!this.currentBundle?.onboardConfig?.omoc) {
      return null;
    }

    const omoc = this.currentBundle.onboardConfig.omoc;

    return {
      project: {
        name: process.env.CLAWFLINT_WORKSPACE_NAME || "ClawFlint Project",
        repo: process.env.CLAWFLINT_REPO || "",
      },
      agents: omoc.teamConfig.agents.reduce(
        (acc, agent) => {
          acc[agent.role] = {
            enabled: agent.enabled,
            defaultTier: agent.modelTier,
          };
          return acc;
        },
        {} as Record<string, unknown>,
      ),
      workflows: {
        defaultApprovalGate: "required",
        loopMaxIterations: 100,
        parallelMaxWorkers: omoc.teamConfig.maxParallelWorkers,
      },
      costControls: {
        ...omoc.costControls,
        hardStopOnBudget: true,
      },
      eventRouting: {
        ...omoc.eventRouting,
        mentionPolicy: {},
      },
    };
  }

  getCurrentVersion(): number {
    return this.currentBundle?.versionNumber ?? 0;
  }

  isOmocEnabled(): boolean {
    return this.currentBundle?.onboardConfig?.omoc?.enabled ?? false;
  }
}

export const configBundleManager = new ConfigBundleManager();
