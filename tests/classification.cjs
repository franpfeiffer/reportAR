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
  choice: (instructions, criteria) => ({ instructions, criteria }),
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

const options = {
  street_damage: "BACHE",
  flooding: "INUNDACION",
  public_lighting: "ALUMBRADO",
  waste_and_cleanliness: "BASURA",
  trees_and_green_spaces: "ARBOLADO",
  other_municipal_issue: "OTRO",
};
function responseFor(choice, selectedProbability = 0.75) {
  const remainder = (1 - selectedProbability) / (Object.keys(options).length - 1);
  return {
    model: "jev-1.14.0",
    answers: {
      category: {
        choice,
        confidence: 0.5,
        probabilities: Object.fromEntries(Object.keys(options).map(key => [key, key === choice ? selectedProbability : remainder])),
      },
    },
  };
}

async function main() {
  for (const [option, category] of Object.entries(options)) {
    const decision = classification.decideClassification("OTRO", responseFor(option));
    assert.equal(decision.category, category);
    assert.equal(decision.suggestedCategory, category);
    assert.equal(decision.classificationStatus, "AUTO_ASSIGNED");
  }

  const atThreshold = classification.decideClassification("BACHE", responseFor("flooding", 0.7));
  assert.equal(atThreshold.category, "INUNDACION");
  assert.equal(atThreshold.classificationStatus, "AUTO_ASSIGNED");
  assert.equal(atThreshold.classificationProbability, 0.7);

  const uncertain = classification.decideClassification("BACHE", responseFor("flooding", 0.69));
  assert.equal(uncertain.category, "BACHE");
  assert.equal(uncertain.declaredCategory, "BACHE");
  assert.equal(uncertain.suggestedCategory, "INUNDACION");
  assert.equal(uncertain.classificationStatus, "NEEDS_REVIEW");

  const malformed = classification.decideClassification("BASURA", { model: "jev-test", answers: { category: { choice: "flooding", probabilities: { flooding: 1 } } } });
  assert.equal(malformed.category, "BASURA");
  assert.equal(malformed.classificationStatus, "UNAVAILABLE");

  process.env.TYPESAFE_API_KEY = "unit-test-key";
  sdkError = undefined;
  sdkResponse = responseFor("trees_and_green_spaces", 0.72);
  const classified = await classification.classifyReport("Un árbol cayó sobre la vereda", "BACHE");
  assert.equal(classified.category, "ARBOLADO");
  assert.equal(sdkConfig.defaultModel, "jev-latest");
  assert.equal(sdkConfig.timeout, 8000);
  assert.equal(sdkConfig.retry.maxRetries, 0);
  assert.deepEqual(Object.keys(sdkRequest.state.report).sort(), ["declared_category", "description"]);
  assert.equal(sdkRequest.state.report.description, "Un árbol cayó sobre la vereda");
  assert.equal(sdkRequest.state.report.declared_category, validation.categoryLabels.BACHE);
  assert.equal(Object.keys(sdkRequest.questions.category.criteria).length, 6);

  sdkError = new Error("simulated timeout");
  const failed = await classification.classifyReport("Hay basura acumulada", "BASURA");
  assert.equal(failed.category, "BASURA");
  assert.equal(failed.classificationStatus, "UNAVAILABLE");
  sdkError = undefined;

  delete process.env.TYPESAFE_API_KEY;
  const unconfigured = await classification.classifyReport("Hay poca luz", "ALUMBRADO");
  assert.equal(unconfigured.classificationStatus, "UNAVAILABLE");
  assert.equal(unconfigured.category, "ALUMBRADO");

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
  assert.equal(stored.classificationStatus, "UNAVAILABLE");

  let adminUpdate;
  const adminSchema = { citizenReports: { publicId: "public", status: "status", category: "category", classificationStatus: "classificationStatus" } };
  const adminDb = { update: () => ({ set: value => { adminUpdate = value; return { where: () => ({ returning: async () => [{ publicId: reportId, category: value.category, classificationStatus: value.classificationStatus }] }) }; } }) };
  const adminRoute = compile("app/api/admin/reports/[id]/route.ts", p => {
    if (p === "@reportar/auth") return { getCurrentProfile: async () => ({ role: "MUNICIPAL_ADMIN" }) };
    if (p === "@reportar/db") return { db: adminDb };
    if (p === "@reportar/db/schema") return adminSchema;
    if (p === "drizzle-orm") return { eq: () => true };
    if (p === "@/lib/reports/validation") return validation;
    return require(p);
  });
  const reviewResponse = await adminRoute.PATCH(new Request("https://test.invalid/api/admin/reports/" + reportId, {
    method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category: "ARBOLADO" }),
  }), { params: Promise.resolve({ id: reportId }) });
  assert.equal(reviewResponse.status, 200);
  assert.equal(adminUpdate.category, "ARBOLADO");
  assert.equal(adminUpdate.classificationStatus, "REVIEWED");

  console.log("JEV classification and route tests passed (six labels, threshold, fallback, privacy, web persistence, admin review)");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
