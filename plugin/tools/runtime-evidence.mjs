#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUTCOME_ENUM = new Set(["confirmed", "refuted", "skipped", "error"]);
const SOURCE_ENUM = new Set(["playwright-json"]);
const POLARITY_ENUM = new Set(["finding-condition", "healthy-invariant"]);
const PROBE_TYPE_ENUM = new Set(["contrast", "overlap", "scope-token", "manual-runtime"]);
const RENDERED_DOM_RE = /\b(rendered[- ]?dom|runtime|browser|viewport|computed style|screenshot|visual regression|layout|overlap|contrast|foreground|background|css variable|theme token|cascade)\b/i;
const CONTRAST_RE = /\b(contrast|color|foreground|background|computed style)\b/i;
const OVERLAP_RE = /\b(overlap|collision|clipping|clipped|viewport|bounding box|layout)\b/i;
const SCOPE_TOKEN_RE = /\b(scope|token|theme token|css variable|custom property|cascade|propagation)\b/i;
const RFC3339_DATE_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/;

function usage() {
  return `Usage:
  node <AIVV_ROOT>/tools/runtime-evidence.mjs emit --review <review-log.json> [--out-dir <dir>]
  node <AIVV_ROOT>/tools/runtime-evidence.mjs ingest --review <review-log.json> --results <results.json> [--manifest <manifest.json>]
  node <AIVV_ROOT>/tools/runtime-evidence.mjs validate --review <review-log.json>`;
}

function fail(message, code = 1) {
  console.error(`runtime-evidence: ${message}`);
  process.exit(code);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || !["emit", "ingest", "validate"].includes(command)) fail(usage(), 2);
  const args = { command };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith("--")) fail(`unexpected argument: ${token}`, 2);
    const eqIndex = token.indexOf("=");
    const key = token.slice(2, eqIndex === -1 ? undefined : eqIndex);
    const value = eqIndex === -1 ? rest[++index] : token.slice(eqIndex + 1);
    if (!value || value.startsWith("--")) fail(`missing value for --${key}`, 2);
    args[key.replaceAll("-", "_")] = value;
  }
  if (!args.review) fail("--review is required", 2);
  if (command === "ingest" && !args.results) fail("--results is required for ingest", 2);
  return args;
}

export function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tmp, file);
}

function toAbsolute(file) {
  return path.resolve(process.cwd(), file);
}

export function defaultOutDir(review) {
  if (typeof review.target_project !== "string" || review.target_project.trim() === "") {
    throw new Error("review.target_project is required unless --out-dir is supplied");
  }
  const target = path.resolve(review.target_project);
  let stat;
  try {
    stat = fs.statSync(target);
  } catch {
    throw new Error(`review.target_project is not an existing directory: ${review.target_project}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`review.target_project is not a directory: ${review.target_project}`);
  }
  return path.join(target, ".aivv/runtime-probes");
}

export function findingId(finding) {
  return finding?.ref ?? finding?.id;
}

function textForFinding(finding) {
  return [
    finding?.summary,
    finding?.description,
    finding?.impact,
    finding?.severity_rationale,
    Array.isArray(finding?.evidence) ? JSON.stringify(finding.evidence) : "",
    Array.isArray(finding?.grounded_by) ? JSON.stringify(finding.grounded_by) : ""
  ].filter(Boolean).join("\n");
}

export function isRuntimeEligible(finding) {
  if (!isObject(finding)) return false;
  if (Object.hasOwn(finding, "runtime_evidence")) return true;
  if (Array.isArray(finding.evidence) && finding.evidence.some((item) => item?.kind === "runtime")) return true;
  if (Array.isArray(finding.grounded_by) && finding.grounded_by.some((item) => item?.source_type === "runtime")) return true;
  return RENDERED_DOM_RE.test(textForFinding(finding));
}

export function probeTypeFor(finding) {
  const text = textForFinding(finding);
  if (SCOPE_TOKEN_RE.test(text)) return "scope-token";
  if (CONTRAST_RE.test(text)) return "contrast";
  if (OVERLAP_RE.test(text)) return "overlap";
  return "manual-runtime";
}

function assertionPolarityFor() {
  return "finding-condition";
}

function sanitizeRef(ref) {
  return String(ref).replace(/[^A-Za-z0-9._-]/g, "-");
}

function selectorEnvFor(ref) {
  return `AIVV_PROBE_${sanitizeRef(ref).replace(/[^A-Za-z0-9]/g, "_").toUpperCase()}_SELECTOR`;
}

function relativeSpecPath(outDir, filename) {
  const normalizedOut = path.resolve(outDir);
  const targetRoot = normalizedOut.endsWith(path.join(".aivv", "runtime-probes"))
    ? normalizedOut.slice(0, -path.join(".aivv", "runtime-probes").length).replace(/[\/\\]$/, "")
    : null;
  if (targetRoot) return path.posix.join(".aivv/runtime-probes", filename);
  return path.relative(REPO_ROOT, path.join(normalizedOut, filename)).replaceAll(path.sep, "/");
}

function probeForFinding(review, finding, outDir) {
  const ref = findingId(finding);
  if (!ref) throw new Error("runtime-eligible finding is missing ref or id");
  if (!finding.fingerprint) throw new Error(`finding ${ref} is missing fingerprint`);
  const probeType = probeTypeFor(finding);
  const filename = `${sanitizeRef(ref)}-${probeType}.spec.ts`;
  return {
    probe_id: `${review.id}-${sanitizeRef(ref)}-${probeType}`,
    finding_ref: ref,
    finding_fingerprint: finding.fingerprint,
    probe_type: probeType,
    assertion_polarity: assertionPolarityFor(probeType),
    spec_path: relativeSpecPath(outDir, filename),
    test_title: `AIVV finding ${ref}: ${probeType}`,
    filename,
    selector_env: selectorEnvFor(ref)
  };
}

function jsString(value) {
  return JSON.stringify(String(value ?? ""));
}

function specBody(review, finding, probe) {
  const ref = findingId(finding);
  const summary = String(finding.summary ?? finding.description ?? "").replace(/\s+/g, " ").slice(0, 220);
  return `import { test, expect } from "@playwright/test";

// AIVV runtime probe scaffold.
// Review id: ${review.id}
// Finding: ${ref}
// Probe type: ${probe.probe_type}
// Source summary: ${summary}
// REVIEW THIS FILE BEFORE RUNNING.

test.describe.configure({ retries: 0 });

test(${jsString(probe.test_title)}, async ({ page }) => {
  const url = process.env.AIVV_DEV_URL;
  const selector = process.env.${probe.selector_env};
  test.skip(!url, "Set AIVV_DEV_URL to the target development URL before running this probe.");
  test.skip(!selector, "Set ${probe.selector_env} to the rendered element selector before running this probe.");

  await page.goto(url);
  const subject = page.locator(selector).first();
  await expect(subject, "AIVV probe selector must resolve before checking the runtime finding condition.").toBeVisible();
${probeAssertion(probe)}
});
`;
}

function probeAssertion(probe) {
  if (probe.probe_type === "contrast") {
    return `  const colors = await subject.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return { color: style.color, backgroundColor: style.backgroundColor };
  });
  console.log("AIVV contrast scaffold computed colors", colors);
  test.skip(true, "Manual contrast probe scaffold: replace this skip with a project-specific contrast-ratio assertion before ingesting a confirmed/refuted result.");`;
  }
  if (probe.probe_type === "overlap") {
    return `  const otherSelector = process.env.${probe.selector_env}_OTHER;
  test.skip(!otherSelector, "Set ${probe.selector_env}_OTHER to the comparison selector for overlap probes.");
  const other = page.locator(otherSelector).first();
  await expect(other, "AIVV overlap comparison selector must resolve.").toBeVisible();
  const boxes = await Promise.all([subject.boundingBox(), other.boundingBox()]);
  test.skip(!boxes[0] || !boxes[1], "AIVV overlap probe requires visible bounding boxes.");
  const [a, b] = boxes;
  const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  expect(xOverlap * yOverlap, "finding condition: rendered boxes overlap").toBeGreaterThan(0);`;
  }
  if (probe.probe_type === "scope-token") {
    return `  const tokenName = process.env.${probe.selector_env}_TOKEN;
  test.skip(!tokenName, "Set ${probe.selector_env}_TOKEN to the CSS custom property name for scope-token probes.");
  const value = await subject.evaluate((element, name) => window.getComputedStyle(element).getPropertyValue(name).trim(), tokenName);
  expect(value, "finding condition: scoped token is missing or unresolved at runtime").toBe("");`;
  }
  return `  test.skip(true, "Manual runtime probe scaffold: inspect the rendered element and replace this skip with a project-specific finding-condition assertion.");`;
}

function emit(args) {
  const reviewPath = toAbsolute(args.review);
  const review = loadJson(reviewPath);
  const outDir = args.out_dir ? path.resolve(process.cwd(), args.out_dir) : defaultOutDir(review, reviewPath);
  fs.mkdirSync(outDir, { recursive: true });
  const findings = Array.isArray(review.findings) ? review.findings : [];
  const probes = findings.filter(isRuntimeEligible).map((finding) => probeForFinding(review, finding, outDir));
  for (const probe of probes) {
    const finding = findings.find((candidate) => findingId(candidate) === probe.finding_ref);
    fs.writeFileSync(path.join(outDir, probe.filename), specBody(review, finding, probe));
  }
  const manifest = {
    schema_version: 1,
    review_id: review.id,
    generated_at: new Date().toISOString(),
    probes: probes.map(({ filename, selector_env, ...probe }) => probe)
  };
  writeJsonAtomic(path.join(outDir, "manifest.json"), manifest);
  console.log(JSON.stringify({ status: "emitted", manifest_path: path.join(outDir, "manifest.json"), probes: probes.length }, null, 2));
}

function defaultManifestPath(review) {
  return path.join(defaultOutDir(review), "manifest.json");
}

function basename(value) {
  return path.basename(String(value ?? "").replaceAll("\\", "/"));
}

function flattenPlaywrightResults(resultsJson) {
  const cases = [];
  function walk(node, inherited = {}) {
    if (Array.isArray(node)) {
      for (const item of node) walk(item, inherited);
      return;
    }
    if (!isObject(node)) return;
    const next = {
      file: node.file ?? inherited.file,
      titlePath: [...(inherited.titlePath ?? []), typeof node.title === "string" ? node.title : null].filter(Boolean)
    };
    if (Array.isArray(node.tests)) {
      for (const testCase of node.tests) {
        const title = Array.isArray(testCase.titlePath)
          ? testCase.titlePath.at(-1)
          : testCase.title ?? testCase.projectName ?? next.titlePath.at(-1);
        cases.push({
          title,
          titlePath: Array.isArray(testCase.titlePath) ? testCase.titlePath : [...next.titlePath, title].filter(Boolean),
          file: testCase.file ?? next.file,
          results: Array.isArray(testCase.results) ? testCase.results : [],
          expectedStatus: testCase.expectedStatus,
          annotations: Array.isArray(testCase.annotations) ? testCase.annotations : [],
          outcome: typeof testCase.outcome === "function" ? undefined : testCase.outcome,
          raw: testCase
        });
      }
    }
    for (const key of ["suites", "specs", "projects"]) {
      if (Array.isArray(node[key])) walk(node[key], next);
    }
  }
  walk(resultsJson);
  return cases;
}

function resultMessage(testCase, outcomeReason) {
  const messages = [];
  if (outcomeReason) messages.push(outcomeReason);
  for (const result of testCase.results ?? []) {
    for (const error of result.errors ?? []) {
      if (error?.message) messages.push(error.message);
    }
    if (result.error?.message) messages.push(result.error.message);
    if (result.status) messages.push(`status:${result.status}`);
  }
  if (testCase.outcome) messages.push(`outcome:${testCase.outcome}`);
  return [...new Set(messages)].join("; ");
}

export function mapRuntimeOutcome(status, polarity) {
  if (status === "skipped") return "skipped";
  if (status === "passed") return polarity === "healthy-invariant" ? "refuted" : "confirmed";
  if (status === "failed") return polarity === "healthy-invariant" ? "confirmed" : "refuted";
  return "error";
}

function hasExpectedFailureAnnotation(testCase) {
  return (testCase.annotations ?? []).some((annotation) => /^(fail|fixme)$/i.test(String(annotation?.type ?? annotation)));
}

function classifyPlaywrightCase(testCase, polarity) {
  if ((testCase.results ?? []).length !== 1) {
    return { outcome: "error", message: resultMessage(testCase, "multiple Playwright results/retries are not accepted for runtime evidence") };
  }
  if (testCase.expectedStatus && testCase.expectedStatus !== "passed") {
    return { outcome: "error", message: resultMessage(testCase, `expectedStatus:${testCase.expectedStatus}`) };
  }
  if (hasExpectedFailureAnnotation(testCase)) {
    return { outcome: "error", message: resultMessage(testCase, "expected-failure annotation present") };
  }
  if (testCase.outcome === "flaky") {
    return { outcome: "error", message: resultMessage(testCase, "flaky Playwright outcome") };
  }
  const [result] = testCase.results;
  if (result.retry && result.retry !== 0) {
    return { outcome: "error", message: resultMessage(testCase, `retry:${result.retry}`) };
  }
  const outcome = mapRuntimeOutcome(result.status, polarity);
  return { outcome, message: resultMessage(testCase) };
}

function matchCaseIndexes(probe, cases, used) {
  const byTitle = cases
    .map((testCase, index) => ({ testCase, index }))
    .filter(({ testCase, index }) => !used.has(index) && testCase.title === probe.test_title)
    .map(({ index }) => index);
  if (byTitle.length > 0) return byTitle;
  const probeBase = basename(probe.spec_path);
  return cases
    .map((testCase, index) => ({ testCase, index }))
    .filter(({ testCase, index }) => !used.has(index) && basename(testCase.file) === probeBase)
    .map(({ index }) => index);
}

function appendUnique(array, value) {
  const next = Array.isArray(array) ? [...array] : [];
  if (!next.includes(value)) next.push(value);
  return next;
}

function timestampFromCase(testCase, ingestTime) {
  const result = testCase?.results?.[0];
  for (const value of [result?.startTime, result?.start_time, testCase?.startTime, testCase?.start_time]) {
    if (typeof value === "string" && isStrictRfc3339DateTime(value)) return new Date(value).toISOString();
  }
  return ingestTime;
}

function runtimeEvidenceFor({ review, finding, probe, testCase, classification, resultsPath, ingestTime }) {
  return {
    outcome: classification.outcome,
    source: "playwright-json",
    probe_id: probe.probe_id,
    review_id: review.id,
    finding_ref: probe.finding_ref,
    finding_fingerprint: probe.finding_fingerprint,
    assertion_polarity: probe.assertion_polarity,
    spec_path: probe.spec_path,
    result_path: resultsPath,
    test_title: probe.test_title,
    assertion_message: classification.message || undefined,
    ran_at: timestampFromCase(testCase, ingestTime),
    updated_at: ingestTime
  };
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, stripUndefined(item)]));
}

function verifyManifest(review, manifest) {
  if (manifest.schema_version !== 1) throw new Error("manifest.schema_version must be 1");
  if (manifest.review_id !== review.id) throw new Error(`manifest review_id ${manifest.review_id} does not match review id ${review.id}`);
  const byRef = new Map((review.findings ?? []).map((finding) => [findingId(finding), finding]));
  const manifestRefs = new Set();
  for (const probe of manifest.probes ?? []) {
    if (!POLARITY_ENUM.has(probe.assertion_polarity)) throw new Error(`probe ${probe.probe_id} has invalid assertion_polarity`);
    if (!PROBE_TYPE_ENUM.has(probe.probe_type)) throw new Error(`probe ${probe.probe_id} has invalid probe_type`);
    manifestRefs.add(probe.finding_ref);
    const finding = byRef.get(probe.finding_ref);
    if (!finding) throw new Error(`manifest probe ${probe.probe_id} references missing finding ${probe.finding_ref}`);
    if (finding.fingerprint !== probe.finding_fingerprint) {
      throw new Error(`manifest probe ${probe.probe_id} fingerprint mismatch for finding ${probe.finding_ref}`);
    }
  }
  for (const finding of review.findings ?? []) {
    if (!isRuntimeEligible(finding)) continue;
    const ref = findingId(finding);
    if (!manifestRefs.has(ref)) throw new Error(`manifest missing runtime-eligible finding ${ref}`);
  }
}

function ingest(args) {
  const reviewPath = toAbsolute(args.review);
  const resultsPath = toAbsolute(args.results);
  const review = loadJson(reviewPath);
  const manifestPath = args.manifest ? toAbsolute(args.manifest) : defaultManifestPath(review);
  const manifest = loadJson(manifestPath);
  verifyManifest(review, manifest);

  const results = loadJson(resultsPath);
  const cases = flattenPlaywrightResults(results);
  const used = new Set();
  const probesByRef = new Map((manifest.probes ?? []).map((probe) => [probe.finding_ref, probe]));
  const ingestTime = new Date().toISOString();
  const counts = { confirmed: 0, refuted: 0, skipped: 0, error: 0 };
  const warningsToAppend = [];

  const nextReview = structuredClone(review);
  for (const finding of nextReview.findings ?? []) {
    if (!isRuntimeEligible(finding)) continue;
    const ref = findingId(finding);
    const probe = probesByRef.get(ref);
    if (!probe) continue;
    const matchIndexes = matchCaseIndexes(probe, cases, used);
    let testCase = null;
    let classification;
    if (matchIndexes.length === 0) {
      classification = { outcome: "skipped", message: "No matching Playwright result found for manifest-bound runtime probe." };
    } else if (matchIndexes.length > 1) {
      matchIndexes.forEach((index) => used.add(index));
      testCase = cases[matchIndexes[0]];
      classification = { outcome: "error", message: `Ambiguous Playwright result: ${matchIndexes.length} cases matched manifest-bound probe. Re-run with a single project or split results by manifest binding.` };
    } else {
      const [matchIndex] = matchIndexes;
      used.add(matchIndex);
      testCase = cases[matchIndex];
      classification = classifyPlaywrightCase(testCase, probe.assertion_polarity);
    }
    counts[classification.outcome] += 1;
    finding.runtime_evidence = stripUndefined(runtimeEvidenceFor({
      review: nextReview,
      finding,
      probe,
      testCase,
      classification,
      resultsPath,
      ingestTime
    }));
    finding.epistemic_modes = appendUnique(finding.epistemic_modes, "runtime-probe");
    finding.evidence_modes_diversity = "multi-mode";
  }

  cases.forEach((testCase, index) => {
    if (used.has(index)) return;
    warningsToAppend.push({
      kind: "runtime-evidence-orphan-result",
      detail: `Ignoring unmatched Playwright result: ${testCase.title ?? "(untitled)"}`,
      test_title: testCase.title ?? null,
      file: testCase.file ?? null
    });
  });

  nextReview.warnings = [...(Array.isArray(nextReview.warnings) ? nextReview.warnings : []), ...warningsToAppend];
  nextReview.runtime_evidence_ingest = {
    review_id: nextReview.id,
    results_path: resultsPath,
    manifest_path: manifestPath,
    counts,
    orphan_results: warningsToAppend.length,
    updated_at: ingestTime
  };

  const verdict = validateReviewRuntimeEvidence(nextReview);
  if (verdict.status !== "valid") {
    throw new Error(`candidate review failed runtime evidence validation: ${verdict.errors.join("; ")}`);
  }
  writeJsonAtomic(reviewPath, nextReview);
  console.log(JSON.stringify({ status: "ingested", counts, orphan_results: warningsToAppend.length }, null, 2));
}

function isLeapYear(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function isStrictRfc3339DateTime(value) {
  const match = RFC3339_DATE_TIME_RE.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (!/^[Zz]$/.test(offsetText)) {
    const offsetHour = Number(offsetText.slice(1, 3));
    const offsetMinute = Number(offsetText.slice(4, 6));
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return true;
}

export function validateRuntimeEvidenceObject(obj, review, finding) {
  const errors = [];
  if (!isObject(obj)) return ["runtime_evidence must be an object"];
  for (const field of ["outcome", "source", "probe_id", "review_id", "finding_ref", "finding_fingerprint", "assertion_polarity", "spec_path", "result_path", "test_title", "ran_at", "updated_at"]) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === "") errors.push(`runtime_evidence.${field} is required`);
  }
  if (!OUTCOME_ENUM.has(obj.outcome)) errors.push(`invalid runtime_evidence.outcome: ${obj.outcome}`);
  if (!SOURCE_ENUM.has(obj.source)) errors.push(`invalid runtime_evidence.source: ${obj.source}`);
  if (!POLARITY_ENUM.has(obj.assertion_polarity)) errors.push(`invalid runtime_evidence.assertion_polarity: ${obj.assertion_polarity}`);
  if (review?.id && obj.review_id !== review.id) errors.push("runtime_evidence.review_id does not match review id");
  if (finding && obj.finding_ref !== findingId(finding)) errors.push("runtime_evidence.finding_ref does not match finding ref/id");
  if (finding?.fingerprint && obj.finding_fingerprint !== finding.fingerprint) errors.push("runtime_evidence.finding_fingerprint does not match finding fingerprint");
  for (const field of ["ran_at", "updated_at"]) {
    if (typeof obj[field] !== "string" || !isStrictRfc3339DateTime(obj[field])) errors.push(`runtime_evidence.${field} must be a valid RFC3339 date-time`);
  }
  return errors;
}

export function validateReviewRuntimeEvidence(review) {
  const errors = [];
  if (!isObject(review)) return { status: "invalid", errors: ["review must be an object"] };
  for (const finding of review.findings ?? []) {
    if (Object.hasOwn(finding, "runtime_evidence")) {
      errors.push(...validateRuntimeEvidenceObject(finding.runtime_evidence, review, finding).map((error) => `${findingId(finding) ?? "finding"}: ${error}`));
    }
    if (Object.hasOwn(finding, "epistemic_modes")) {
      if (!Array.isArray(finding.epistemic_modes)) {
        errors.push(`${findingId(finding) ?? "finding"}: epistemic_modes must be an array`);
      } else {
        const seenModes = new Set();
        for (const mode of finding.epistemic_modes) {
          if (typeof mode !== "string" || mode.trim() === "") {
            errors.push(`${findingId(finding) ?? "finding"}: epistemic_modes entries must be non-empty strings`);
          } else if (seenModes.has(mode)) {
            errors.push(`${findingId(finding) ?? "finding"}: epistemic_modes entries must be unique`);
          }
          seenModes.add(mode);
        }
      }
    }
    if (Object.hasOwn(finding, "evidence_modes_diversity") && !["single-mode", "multi-mode"].includes(finding.evidence_modes_diversity)) {
      errors.push(`${findingId(finding) ?? "finding"}: evidence_modes_diversity must be single-mode or multi-mode`);
    }
  }
  if (Object.hasOwn(review, "runtime_evidence_ingest")) {
    const ingest = review.runtime_evidence_ingest;
    if (!isObject(ingest)) {
      errors.push("runtime_evidence_ingest must be an object");
    } else {
      for (const field of ["review_id", "results_path", "manifest_path", "counts", "updated_at"]) {
        if (ingest[field] === undefined || ingest[field] === null || ingest[field] === "") errors.push(`runtime_evidence_ingest.${field} is required`);
      }
      if (ingest.review_id !== review.id) errors.push("runtime_evidence_ingest.review_id does not match review id");
      if (!isObject(ingest.counts)) {
        errors.push("runtime_evidence_ingest.counts must be an object");
      } else {
        for (const key of OUTCOME_ENUM) {
          if (!Number.isInteger(ingest.counts[key]) || ingest.counts[key] < 0) errors.push(`runtime_evidence_ingest.counts.${key} must be a non-negative integer`);
        }
      }
      if (typeof ingest.updated_at !== "string" || !isStrictRfc3339DateTime(ingest.updated_at)) {
        errors.push("runtime_evidence_ingest.updated_at must be a valid RFC3339 date-time");
      }
    }
  }
  return errors.length === 0 ? { status: "valid", errors: [] } : { status: "invalid", errors };
}

function validateCommand(args) {
  const review = loadJson(toAbsolute(args.review));
  const verdict = validateReviewRuntimeEvidence(review);
  console.log(JSON.stringify(verdict, null, 2));
  if (verdict.status !== "valid") process.exit(1);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  try {
    if (args.command === "emit") emit(args);
    if (args.command === "ingest") ingest(args);
    if (args.command === "validate") validateCommand(args);
  } catch (error) {
    fail(error.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
