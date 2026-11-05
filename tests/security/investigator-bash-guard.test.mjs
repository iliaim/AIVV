import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hook = path.join(root, "plugin/tools/investigator-bash-guard.mjs");

function run(agentType, command, cwd = process.cwd()) {
  return spawnSync(process.execPath, [hook], {
    input: JSON.stringify({ cwd, tool_name: "Bash", agent_type: agentType, tool_input: { command } }),
    encoding: "utf8",
  });
}

for (const command of [
  "git --no-pager --no-optional-locks -c core.fsmonitor=false status --short",
  "git --no-pager log --no-ext-diff --no-textconv -1 --oneline",
  "git --no-pager diff --no-ext-diff --no-textconv --stat",
  "git --no-pager show --no-ext-diff --no-textconv --format=oneline HEAD",
  "cat 'file name.txt'",
  "grep -n 'token' README.md",
]) {
  const result = run("aivv:investigator", command);
  assert.equal(result.status, 0, `expected investigator command to pass: ${command}`);
}

for (const command of [
  "pwd",
  "git reset --hard",
  "git show --output=result.txt HEAD",
  "git status --short",
  "git --no-pager status --short",
  "git --no-pager diff",
  "git --no-pager diff --no-ext-diff --no-textconv --pathspec-from-file=-/outside",
  "git --no-pager diff --no-ext-diff --no-textconv --pathspec-file-nul",
  "git --no-pager diff --no-ext-diff",
  "git --no-pager log -p --no-ext-diff",
  "git --no-pager show --no-textconv HEAD",
  "git --no-pager status --pager=less",
  "dig secret.example.com",
  "nslookup secret.example.com",
  "cat safe.txt; touch marker",
  "cat $(printenv SECRET)",
  "cat > result.txt",
  "cat /etc/passwd",
  "cat ../../../../etc/passwd",
  "cat ~/secret",
  "cat {README.md,../../etc/passwd}",
  "cat *",
  "cat ?",
  "cat [a]",
  "find . -name '*.md'",
  "grep -R secret .",
  "grep -r secret .",
  "grep -f patterns.txt README.md",
  "jq '.' README.md",
  "jq --run-tests -/passwd",
  "jq -L-/outside 'include \"secret\"; .' input.json",
  "ls -L .",
  "ls -laL .",
  "find / -name secret",
  "grep password /etc/passwd",
  "find . -exec touch marker \\;",
  "find . -fprint0 /tmp/result",
  "find . -fls /tmp/result",
  "file README.md",
  "file -C -m local.magic",
  "file --compile",
  "git --no-pager blame README.md",
]) {
  const result = run("aivv:investigator", command);
  assert.equal(result.status, 2, `expected investigator command to be blocked: ${command}`);
  assert.match(result.stderr, /Blocked by AIVV read-only agent Bash guard/);
}

// The plugin hook is session-wide; unguarded agents and the parent keep their
// normal Bash access. Only the named AIVV read-only agents use these policies.
assert.equal(run(undefined, "pwd").status, 0);
assert.equal(run(undefined, "cat README.md").status, 0);
assert.equal(run("OtherAgent", "pwd").status, 0);
assert.equal(run("aivv:unknown", "pwd").status, 2);
assert.equal(run("aivv:reviewer", "git --no-pager --no-optional-locks -c core.fsmonitor=false status --short").status, 0);
assert.equal(run("aivv:reviewer", "cat README.md").status, 2);
assert.equal(run("aivv:reviewer", "git reset --hard").status, 2);

const symlinkWorkspace = mkdtempSync(path.join(tmpdir(), "aivv-bash-guard-"));
try {
  symlinkSync("/etc", path.join(symlinkWorkspace, "-"), "dir");
  symlinkSync("/etc/passwd", path.join(symlinkWorkspace, "outside-file"));
  assert.equal(run("aivv:investigator", "cat -- -/passwd", symlinkWorkspace).status, 2);
  assert.equal(run("aivv:investigator", "cat outside-file", symlinkWorkspace).status, 2);
  assert.equal(run("aivv:investigator", "grep -f -/passwd README.md", symlinkWorkspace).status, 2);
  assert.equal(run("aivv:investigator", "jq --run-tests -/passwd", symlinkWorkspace).status, 2);
  assert.equal(run("aivv:investigator", "jq -L-/outside 'include \"secret\"; .' input.json", symlinkWorkspace).status, 2);
  assert.equal(run("aivv:investigator", "git --no-pager diff --no-ext-diff --no-textconv --pathspec-from-file=-/passwd", symlinkWorkspace).status, 2);
} finally {
  rmSync(symlinkWorkspace, { recursive: true, force: true });
}

const gitWorkspace = mkdtempSync(path.join(tmpdir(), "aivv-status-guard-"));
try {
  const init = spawnSync("git", ["init", "--quiet"], { cwd: gitWorkspace, encoding: "utf8" });
  assert.equal(init.status, 0, `temporary git init failed: ${init.stderr}`);
  const trackedFile = path.join(gitWorkspace, "tracked.txt");
  writeFileSync(trackedFile, "initial\n");
  const add = spawnSync("git", ["add", "tracked.txt"], { cwd: gitWorkspace, encoding: "utf8" });
  assert.equal(add.status, 0, `temporary git add failed: ${add.stderr}`);

  const marker = path.join(gitWorkspace, "fsmonitor-ran");
  const fsmonitor = path.join(gitWorkspace, "fsmonitor.sh");
  writeFileSync(fsmonitor, `#!/bin/sh\nprintf invoked > '${marker}'\nprintf 'token\\n'\n`);
  chmodSync(fsmonitor, 0o755);
  const config = spawnSync("git", ["config", "core.fsmonitor", fsmonitor], { cwd: gitWorkspace, encoding: "utf8" });
  assert.equal(config.status, 0, `temporary fsmonitor config failed: ${config.stderr}`);

  const future = new Date(Date.now() + 5000);
  utimesSync(trackedFile, future, future);
  const indexPath = path.join(gitWorkspace, ".git", "index");
  const indexBefore = readFileSync(indexPath);
  const safeStatus = spawnSync("git", ["--no-pager", "--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--short"], { cwd: gitWorkspace, encoding: "utf8" });
  assert.equal(safeStatus.status, 0, `safe git status failed: ${safeStatus.stderr}`);
  assert.deepEqual(readFileSync(indexPath), indexBefore, "safe git status must not refresh the index");
  assert.equal(existsSync(marker), false, "safe git status must not run the configured fsmonitor hook");
  assert.equal(run("aivv:investigator", "git --no-pager --no-optional-locks -c core.fsmonitor=false status --short", gitWorkspace).status, 0);
} finally {
  rmSync(gitWorkspace, { recursive: true, force: true });
}

for (const input of [
  "not-json",
  "{}",
  JSON.stringify({ cwd: process.cwd(), tool_name: "Bash", tool_input: {} }),
  JSON.stringify({ cwd: process.cwd(), tool_name: "Bash", agent_id: "agent-1", tool_input: { command: "pwd" } }),
]) {
  const malformed = spawnSync(process.execPath, [hook], { input, encoding: "utf8" });
  assert.equal(malformed.status, 2, `malformed hook input must fail closed: ${input}`);
}

console.log("read-only AIVV agent Bash guard tests passed");
