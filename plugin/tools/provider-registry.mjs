import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOLS_DIR = dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = dirname(TOOLS_DIR);
const CATALOG_PATH = join(TOOLS_DIR, 'model-catalog.json');

export const providerCatalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
export const providerIds = Object.freeze(Object.keys(providerCatalog.providers || {}).sort());
export const defaultProviderPriority = Object.freeze([...(providerCatalog.default_provider_priority || [])]);

export function getProvider(providerId) {
  const providers = providerCatalog.providers ?? {};
  if (typeof providerId !== 'string' || !Object.hasOwn(providers, providerId)) {
    throw new Error('Unknown provider "' + providerId + '". Registered providers: ' + providerIds.join(', '));
  }
  return providers[providerId];
}

export function resolveProviderPriority(configuredPriority = []) {
  if (configuredPriority !== null && !Array.isArray(configuredPriority)) {
    throw new Error('Configured provider priority must be an array of provider IDs');
  }
  const priority = Array.isArray(configuredPriority) && configuredPriority.length
    ? configuredPriority
    : defaultProviderPriority;
  if (!Array.isArray(priority) || new Set(priority).size !== priority.length) {
    throw new Error('Configured provider priority must be an array without duplicate IDs');
  }
  for (const providerId of priority) getProvider(providerId);
  return [...priority];
}

export function assertProviderAdapterParity(adapterIds) {
  const adapters = [...new Set(adapterIds)].sort();
  const missingAdapters = providerIds.filter(id => !adapters.includes(id));
  const unregisteredAdapters = adapters.filter(id => !providerIds.includes(id));
  if (missingAdapters.length || unregisteredAdapters.length) {
    throw new Error([
      missingAdapters.length ? 'Missing runtime adapters: ' + missingAdapters.join(', ') : '',
      unregisteredAdapters.length ? 'Runtime adapters absent from the provider catalog: ' + unregisteredAdapters.join(', ') : '',
    ].filter(Boolean).join('; '));
  }
  return true;
}

export function validateProviderCatalog() {
  const priority = providerCatalog.default_provider_priority;
  if (!Array.isArray(priority) || priority.length !== providerIds.length ||
      new Set(priority).size !== priority.length ||
      priority.some(id => !providerCatalog.providers[id])) {
    throw new Error('default_provider_priority must list every registered provider exactly once');
  }
  const legacySlots = new Set();
  for (const providerId of providerIds) {
    const provider = getProvider(providerId);
    if (!provider.adapter_source || !provider.command_source || !provider.models?.recommended || !provider.models?.fallback) {
      throw new Error('Provider "' + providerId + '" is missing adapter, command, or model metadata');
    }
    for (const modelRole of ['recommended', 'fallback']) {
      const acceptance = provider.models.acceptance?.[modelRole];
      if (!acceptance || !['unverified-legacy', 'verified'].includes(acceptance.status) || !Array.isArray(acceptance.evidence)) {
        throw new Error('Provider "' + providerId + '" is missing model acceptance status for ' + modelRole);
      }
      if (acceptance.status === 'verified' && (acceptance.evidence.length === 0 || acceptance.evidence.some(item => typeof item !== 'string' || !item.trim()))) {
        throw new Error('Verified model ' + modelRole + ' for provider "' + providerId + '" requires acceptance evidence');
      }
    }
    if (provider.legacy_slot) {
      if (legacySlots.has(provider.legacy_slot)) {
        throw new Error('Duplicate legacy model slot "' + provider.legacy_slot + '"');
      }
      legacySlots.add(provider.legacy_slot);
    }
    for (const source of [provider.adapter_source, provider.command_source]) {
      if (!existsSync(join(PACKAGE_ROOT, source))) {
        throw new Error('Provider "' + providerId + '" references missing source "' + source + '"');
      }
    }
  }
  return true;
}
