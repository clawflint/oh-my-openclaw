import { describe, test, expect } from 'bun:test';
import { OMOcPluginManifest, generateOpenClawConfig } from './manifest.js';

describe('Plugin Manifest', () => {
  test('should include base /omoc command and workflow commands', () => {
    expect(OMOcPluginManifest.commands).toContain('/omoc');
    expect(OMOcPluginManifest.commands).toContain('/run');
    expect(OMOcPluginManifest.commands).toContain('/parallel');
  });

  test('should declare all runtime handlers', () => {
    const handlerNames = OMOcPluginManifest.hooks.map((h) => h.handler);
    expect(handlerNames).toContain('onGatewayStartup');
    expect(handlerNames).toContain('onAgentBootstrap');
    expect(handlerNames).toContain('onMessageReceived');
    expect(handlerNames).toContain('onMessageSent');
    expect(handlerNames).toContain('onToolResult');
  });

  test('should generate OpenClaw config with plugin name', () => {
    const config = generateOpenClawConfig();
    expect(config).toContain('"plugins"');
    expect(config).toContain(OMOcPluginManifest.name);
  });
});
