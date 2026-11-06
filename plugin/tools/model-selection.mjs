#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  getProvider,
  providerIds,
  resolveProviderPriority,
  validateProviderCatalog,
} from './provider-registry.mjs';

const MODEL_POLICIES = new Set(['aivv-recommended', 'family-latest', 'pinned']);

export function buildRequestSettings(config = {}) {
  validateProviderCatalog();
  const providerAuthModes = { ...(config.provider_auth_modes || {}) };
  for (const providerId of providerIds) {
    const legacyKey = getProvider(providerId).legacy_auth_mode_key;
    if (legacyKey && providerAuthModes[providerId] == null && config[legacyKey] != null) {
      providerAuthModes[providerId] = config[legacyKey];
    }
  }

  return {
    reviewer_provider_priority: resolveProviderPriority(config.reviewer_provider_priority),
    model_selection: {
      policy: config.model_policy || 'aivv-recommended',
      provider_overrides: { ...(config.model_overrides || {}) },
      legacy_slot_overrides: {
        primary: config.reviewer_primary ?? null,
        secondary: config.reviewer_secondary ?? null,
        fast: config.reviewer_fast ?? null,
      },
      provider_auth_modes: providerAuthModes,
    },
    auth_mode: config.auth_mode ?? null,
  };
}

export function resolveModelSelection({
  provider: providerId,
  requestedModel = null,
  policy = 'aivv-recommended',
  providerOverrides = {},
  legacySlotOverrides = {},
} = {}) {
  validateProviderCatalog();
  const provider = getProvider(providerId);
  if (typeof requestedModel === 'string' && requestedModel.trim()) {
    return { provider: providerId, model: requestedModel.trim(), model_source: 'request', warnings: [] };
  }
  if (!MODEL_POLICIES.has(policy)) {
    throw new Error('Unsupported model policy "' + policy + '". Supported policies: ' + [...MODEL_POLICIES].join(', '));
  }

  const configured = providerOverrides?.[providerId] ??
    legacySlotOverrides?.[provider.legacy_slot] ?? null;
  if (policy === 'pinned' && typeof configured === 'string' && configured.trim()) {
    return { provider: providerId, model: configured.trim(), model_source: 'provider-config', warnings: [] };
  }

  const warnings = [];
  if (policy === 'family-latest') {
    warnings.push('family-latest is deprecated because model-list ordering is provider-specific; using the registered default for ' + providerId + '.');
  } else if (policy === 'pinned' && !configured) {
    warnings.push('pinned model policy has no override for ' + providerId + '; using the registered default.');
  }
  if (provider.models.acceptance.recommended.status === 'unverified-legacy') {
    warnings.push('The registered default model for ' + providerId + ' is an unverified legacy catalog value; confirm model-specific adapter acceptance before treating it as release-current.');
  }
  return { provider: providerId, model: provider.models.recommended, model_source: 'model-catalog', warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== '--build-request-settings') {
    process.stderr.write('usage: node model-selection.mjs --build-request-settings < resolved-config.json\n');
    process.exit(2);
  }
  try {
    const config = JSON.parse(readFileSync(0, 'utf8'));
    process.stdout.write(JSON.stringify(buildRequestSettings(config)) + '\n');
  } catch (error) {
    process.stderr.write('MODEL_REQUEST_SETTINGS_FAILED: ' + error.message + '\n');
    process.exit(2);
  }
}
