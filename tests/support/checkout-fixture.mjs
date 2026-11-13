// Test fixture for a checkout whose storage identity is reliable on every
// platform, so separate processes resolving `--target` agree on one store.
//
// `storage-paths.mjs` trusts a Linux creation time only when it differs from
// the change time, because some hosts report ctime as the birth time. A
// directory that is created and never changed again (ext4 sets both to the
// same instant at mkdir) is therefore "unreliable", and its identity carries a
// per-invocation nonce by design (see plugin/.aivv/target-resolution.md). A
// real checkout has been written to since it was created, so this fixture adds
// and removes an entry until the change time has moved past the creation time.
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const pause = new Int32Array(new SharedArrayBuffer(4));

export function makeCheckout(dir, { timeoutMs = 5000 } = {}) {
  mkdirSync(dir, { recursive: true });
  const deadline = Date.now() + timeoutMs;
  const marker = path.join(dir, '.aivv-fixture-touch');
  for (;;) {
    const stats = statSync(dir, { bigint: true });
    if (stats.birthtimeNs > 0n && stats.birthtimeNs !== stats.ctimeNs) return dir;
    if (Date.now() > deadline) {
      throw new Error(`${dir}: this filesystem does not report a creation time distinct from the change time, so storage identity is invocation-bound here by design`);
    }
    Atomics.wait(pause, 0, 0, 2);
    writeFileSync(marker, '');
    rmSync(marker);
  }
}
