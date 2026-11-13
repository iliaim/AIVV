// Test fixture for a checkout whose storage identity is reliable on every
// platform, so separate processes resolving `--target` agree on one store.
//
// `storage-paths.mjs` trusts a Linux creation time only when it differs from
// the change time, because some hosts report ctime as the birth time. A
// directory that is created and never changed again (ext4 sets both to the
// same instant at mkdir) is therefore "unreliable", and its identity carries a
// per-invocation nonce by design (see plugin/.aivv/target-resolution.md). A
// real checkout has been written to since it was created, so this fixture adds
// and removes an entry until the product's own reliability check passes. On
// platforms where it already passes, the directory is returned untouched.
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { signatureForStats } from '../../plugin/tools/storage-paths.mjs';

const pause = new Int32Array(new SharedArrayBuffer(4));

export function makeCheckout(dir, { timeoutMs = 5000 } = {}) {
  mkdirSync(dir, { recursive: true });
  const deadline = Date.now() + timeoutMs;
  const marker = path.join(dir, '.aivv-fixture-touch');
  for (;;) {
    if (signatureForStats(statSync(dir, { bigint: true })).reliable) return dir;
    if (Date.now() > deadline) {
      throw new Error(`${dir}: storage identity stayed unreliable on ${process.platform} (no creation time distinct from the change time), so it is invocation-bound here by design`);
    }
    Atomics.wait(pause, 0, 0, 2);
    writeFileSync(marker, '');
    rmSync(marker);
  }
}
