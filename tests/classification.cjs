/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS harness for route and SDK mocks. */
const fs = require("node:fs");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const root = require("node:path").resolve(__dirname, "..");
const ts = require(root + "/node_modules/typescript");

function compile(file, requireFn) {
  const exports = {};
  const js = ts.transpileModule(fs.readFileSync(root + "/" + file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(js, { exports, require: requireFn, process, Buffer, Response, Request, console });
  return exports;
}

const validation = compile("lib/reports/validation.ts", require);
let sdkResponse;
let sdkError;
let sdkRequest;
let sdkConfig;
const sdk = {
  noul: (instructions, criteria) => ({ type: "noul", instructions, criteria }),
  TypeSafeClient: class {
    constructor(config) { sdkConfig = config; }
    async systemOne(request) {
      sdkRequest = request;
      if (sdkError) throw sdkError;
      return sdkResponse;
    }
  },
};
const classification = compile("lib/reports/classification.ts", p => {
  if (p === "server-only") return {};
  if (p === "@typesafe-ai/sdk") return sdk;
  if (p === "./validation") return validation;
  return require(p);
});

function responseFor(urgentProbability) {
  return {
    model: "jev-1.14.0",
    answers: {
      urgent_repair: { type: "noul", noul: urgentProbability },
    },
  };
}

async function main() {
  for (const category of Object.keys(validation.categoryLabels)) {
    const decision = classification.decideClassification(category, responseFor(0.82));
    assert.equal(decision.declaredCategory, category);
    assert.equal(decision.urgency, "URGENTE");
    assert.equal(decision.urgencyClassificationStatus, "AUTO_ASSIGNED");
  }

  const urgentAtThreshold = classification.decideClassification("BACHE", responseFor(0.7));
  assert.equal(urgentAtThreshold.declaredCategory, "BACHE");
  assert.equal(urgentAtThreshold.urgency, "URGENTE");
  assert.equal(urgentAtThreshold.urgencyClassificationStatus, "AUTO_ASSIGNED");
  assert.equal(urgentAtThreshold.urgentProbability, 0.7);

  const notUrgentAtThreshold = classification.decideClassification("ALUMBRADO", responseFor(0.3));
  assert.equal(notUrgentAtThreshold.urgency, "NO_URGENTE");
  assert.equal(notUrgentAtThreshold.urgencyClassificationStatus, "AUTO_ASSIGNED");

  const uncertainUrgent = classification.decideClassification("BACHE", responseFor(0.69));
  assert.equal(uncertainUrgent.urgency, null);
  assert.equal(uncertainUrgent.suggestedUrgency, "URGENTE");
  assert.equal(uncertainUrgent.declaredCategory, "BACHE");
  assert.equal(uncertainUrgent.urgencyClassificationStatus, "NEEDS_REVIEW");

  const uncertainNotUrgent = classification.decideClassification("ARBOLADO", responseFor(0.31));
  assert.equal(uncertainNotUrgent.urgency, null);
  assert.equal(uncertainNotUrgent.suggestedUrgency, "NO_URGENTE");
  assert.equal(uncertainNotUrgent.urgencyClassificationStatus, "NEEDS_REVIEW");

  const notUrgent = classification.decideClassification("BASURA", responseFor(0.12));
  assert.equal(notUrgent.urgency, "NO_URGENTE");
  assert.equal(notUrgent.urgencyClassificationStatus, "AUTO_ASSIGNED");

  const malformed = classification.decideClassification("BASURA", { model: "jev-test", answers: { category: { choice: "flooding", probabilities: { flooding: 1 } } } });
  assert.equal(malformed.declaredCategory, "BASURA");
  assert.equal(malformed.urgencyClassificationStatus, "UNAVAILABLE");

  process.env.TYPESAFE_API_KEY = "unit-test-key";
  sdkError = undefined;
  sdkResponse = responseFor(0.72);
  const classified = await classification.classifyReport("Un árbol cayó sobre la vereda", "BACHE");
  assert.equal(classified.declaredCategory, "BACHE");
  assert.equal(classified.urgency, "URGENTE");
  assert.equal(sdkConfig.defaultModel, "jev-latest");
  assert.equal(sdkConfig.timeout, 8000);
  assert.equal(sdkConfig.retry.maxRetries, 0);
  assert.deepEqual(Object.keys(sdkRequest.state.report).sort(), ["declared_category", "description"]);
  assert.equal(sdkRequest.state.report.description, "Un árbol cayó sobre la vereda");
  assert.equal(sdkRequest.state.report.declared_category, validation.categoryLabels.BACHE);
  assert.equal(sdkRequest.questions.urgent_repair.type, "noul");
  assert.match(sdkRequest.questions.urgent_repair.criteria.true, /peligro inmediato/);

  sdkError = new Error("simulated timeout");
  const failed = await classification.classifyReport("Hay basura acumulada", "BASURA");
  assert.equal(failed.declaredCategory, "BASURA");
  assert.equal(failed.urgencyClassificationStatus, "UNAVAILABLE");
  sdkError = undefined;

  delete process.env.TYPESAFE_API_KEY;
  const unconfigured = await classification.classifyReport("Hay poca luz", "ALUMBRADO");
  assert.equal(unconfigured.urgencyClassificationStatus, "UNAVAILABLE");
  assert.equal(unconfigured.declaredCategory, "ALUMBRADO");

  const stored = {};
  const reportId = "12345678-1234-4123-8123-123456789012";
  const db = { insert: () => ({ values: value => { Object.assign(stored, value); return { returning: async () => [{ publicId: reportId }] }; } }) };
  const unavailable = classification.unavailableClassification;
  const reportRoute = compile("app/api/reports/route.ts", p => {
    if (p === "@reportar/db") return { db };
    if (p === "@reportar/db/schema") return { citizenReports: {} };
    if (p === "@/lib/reports/validation") return validation;
    if (p === "@/lib/reports/classification") return { classifyReport: async () => unavailable("BASURA") };
    return require(p);
  });
  const webResponse = await reportRoute.POST(new Request("https://test.invalid/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category: "BASURA", address: "Calle Ficticia 123", description: "Residuos acumulados junto al contenedor." }),
  }));
  assert.equal(webResponse.status, 201);
  assert.deepEqual(await webResponse.json(), { publicId: reportId });
  assert.equal(stored.category, "BASURA");
  assert.equal(stored.urgencyClassificationStatus, "UNAVAILABLE");

  let adminUpdate;
  const adminSchema = { citizenReports: { publicId: "public", status: "status", category: "category", urgency: "urgency", urgencyClassificationStatus: "urgencyClassificationStatus" } };
  const adminDb = { update: () => ({ set: value => { adminUpdate = value; return { where: () => ({ returning: async () => [{ publicId: reportId, urgency: value.urgency, urgencyClassificationStatus: value.urgencyClassificationStatus }] }) }; } }) };
  const adminRoute = compile("app/api/admin/reports/[id]/route.ts", p => {
    if (p === "@reportar/auth") return { getCurrentProfile: async () => ({ role: "MUNICIPAL_ADMIN" }) };
    if (p === "@reportar/db") return { db: adminDb };
    if (p === "@reportar/db/schema") return adminSchema;
    if (p === "drizzle-orm") return { eq: () => true };
    if (p === "@/lib/reports/validation") return validation;
    return require(p);
  });
  const reviewResponse = await adminRoute.PATCH(new Request("https://test.invalid/api/admin/reports/" + reportId, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ urgency: "URGENTE" }),
  }), { params: Promise.resolve({ id: reportId }) });
  assert.equal(reviewResponse.status, 200);
  assert.equal(adminUpdate.urgency, "URGENTE");
  assert.equal(adminUpdate.urgencyClassificationStatus, "REVIEWED");

  console.log("JEV urgency tests passed (thresholds, uncertain band, six declared categories, fallback, privacy, web persistence, admin review)");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
