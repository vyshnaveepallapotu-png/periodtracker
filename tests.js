// Run with: node tests.js
const assert = require("assert");
const PT = require("./logic.js");

const P = (start, end) => ({ start, end });
let n = 0;
const t = (name, fn) => { fn(); n++; console.log("ok -", name); };

t("date helpers", () => {
  assert.strictEqual(PT.diffDays("2026-01-01", "2026-01-29"), 28);
  assert.strictEqual(PT.addDays("2026-01-30", 3), "2026-02-02");
});

t("regular cycle -> ok and prediction", () => {
  const periods = [P("2026-07-01", "2026-07-05"), P("2026-07-29", "2026-08-02"), P("2026-08-26", "2026-08-30")];
  const r = PT.assess(periods, "2026-09-10", {});
  assert.strictEqual(r.level, "ok");
  assert.strictEqual(r.stats.avgCycle, 28);
  assert.strictEqual(r.stats.predictedNext, "2026-09-23");
});

t("45 days late -> watch", () => {
  const r = PT.assess([P("2026-08-01", "2026-08-05")], "2026-09-15", {});
  assert.strictEqual(r.level, "watch");
});

t("70 days late -> warn", () => {
  const r = PT.assess([P("2026-08-01", "2026-08-05")], "2026-10-10", {});
  assert.strictEqual(r.level, "warn");
});

t("95 days without period -> alert", () => {
  const r = PT.assess([P("2026-07-01", "2026-07-05")], "2026-10-04", {});
  assert.strictEqual(r.level, "alert");
  assert.ok(r.title.includes("3+ months"));
});

t("missed months reported by user (3) -> alert", () => {
  const r = PT.assess([P("2026-10-01", "2026-10-05")], "2026-10-19", { missedMonths: 3 });
  assert.strictEqual(r.level, "alert");
});

t("late period + acne -> possible PCOS/PCOD", () => {
  const r = PT.assess([P("2026-08-01", "2026-08-05")], "2026-09-20", { symptoms: ["acne"] });
  assert.strictEqual(r.level, "alert");
  assert.ok(r.flags.pcosPossible);
  assert.ok(r.title.includes("PCOS"));
});

t("irregular pattern + excess hair -> possible PCOS/PCOD", () => {
  const periods = [P("2026-03-01", "2026-03-05"), P("2026-04-15", "2026-04-19"), P("2026-05-20", "2026-05-24"), P("2026-07-05", "2026-07-09")];
  const r = PT.assess(periods, "2026-07-20", { symptoms: ["excessHair"] });
  assert.ok(r.flags.irregularPattern);
  assert.ok(r.flags.pcosPossible);
});

t("regular cycles + symptoms -> no PCOS flag", () => {
  const periods = [P("2026-07-01", "2026-07-05"), P("2026-07-29", "2026-08-02"), P("2026-08-26", "2026-08-30")];
  const r = PT.assess(periods, "2026-09-10", { symptoms: ["acne", "excessHair"] });
  assert.ok(!r.flags.pcosPossible);
  assert.strictEqual(r.level, "ok");
});

t("ongoing period is not 'late'", () => {
  const r = PT.assess([P("2026-10-17", null)], "2026-10-19", {});
  assert.strictEqual(r.level, "ok");
});

t("no data -> info", () => {
  assert.strictEqual(PT.assess([], "2026-10-19", {}).level, "info");
});

console.log(`\n${n} tests passed`);
