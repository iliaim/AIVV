# Platform adapters

AIVV keeps common review behavior in the shared prompts, skills, schemas, and
runtime. Adapters own only integration differences that cannot be expressed by
the shared contract.

## Host adapters

Host adapters describe agent dispatch, tool surfaces, permission enforcement,
runtime discovery, installation, and lifecycle behavior. Host adapters do not
own review methodology or provider transport details.

## Provider adapters

Provider adapters describe authentication, CLI/API transport, model behavior,
probe support, prompt command context, and structured response compatibility.
The central registry in tools/model-catalog.json owns provider IDs,
default/fallback model IDs and acceptance status, adapter documentation paths,
prompt command source paths, and legacy configuration aliases. tools/provider-registry.mjs
validates that metadata and tools/dispatch.mjs checks registration parity
against the implemented transport map.

## Adding an integration

1. Add shared behavior or provider-neutral prompt changes to the common files.
2. Add a host adapter or provider adapter only for required compatibility behavior.
3. Register provider IDs and metadata in tools/model-catalog.json.
4. Implement provider transport/auth in the provider dispatcher and keep the
   implementation map aligned with the registry.
5. Keep model IDs marked `unverified-legacy` until each model has provider
   adapter acceptance evidence; verified entries require non-empty evidence.
6. Add adapter contract coverage and keep capability claims evidence-based.
7. Run the public tests and package validation.

A registry entry does not itself make an integration available: the adapter
must implement and verify its declared capabilities.
