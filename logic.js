/* Pure logic (no DOM) so it can be tested with Node: `node tests.js` */
(function (root) {
  const DAY = 86400000;

  // ---------- date helpers (all dates are "YYYY-MM-DD" strings) ----------
  function parseISO(s) {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function toISO(d) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function diffDays(a, b) {
    return Math.round((parseISO(b) - parseISO(a)) / DAY);
  }
  function addDays(iso, n) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  // ---------- cycle statistics ----------
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const sortPeriods = (p) => [...p].sort((a, b) => a.start.localeCompare(b.start));

  function cycleLengths(periods) {
    const s = sortPeriods(periods);
    const out = [];
    for (let i = 1; i < s.length; i++) out.push(diffDays(s[i - 1].start, s[i].start));
    return out;
  }

  function periodLengths(periods) {
    return periods.filter((p) => p.end).map((p) => diffDays(p.start, p.end) + 1);
  }

  function summarize(periods, today) {
    const s = sortPeriods(periods);
    const cycles = cycleLengths(s);
    const avgCycle = avg(cycles.slice(-6));
    const avgPeriod = avg(periodLengths(s).slice(-6));
    const last = s.length ? s[s.length - 1] : null;
    const daysSinceLastStart = last ? diffDays(last.start, today) : null;
    const predictedNext = last ? addDays(last.start, Math.round(avgCycle || 28)) : null;
    return {
      count: s.length,
      cycles,
      avgCycle,
      avgPeriod,
      last,
      daysSinceLastStart,
      predictedNext,
      daysToNext: predictedNext ? diffDays(today, predictedNext) : null,
    };
  }

  // ---------- PCOS / PCOD screening ----------
  // Rotterdam criteria (need 2 of 3): irregular/absent ovulation, signs of
  // high androgens (acne, excess hair, hair thinning), polycystic ovaries on
  // ultrasound. This app can only look at the first two, so it only *flags*
  // a possibility. It never diagnoses.
  const ANDROGEN_SIGNS = ["acne", "excessHair", "hairThinning"];
  const METABOLIC_SIGNS = ["weightGain", "darkPatches"];
  const RANK = { info: 0, ok: 1, watch: 2, warn: 3, alert: 4 };

  function assess(periods, today, opts) {
    opts = opts || {};
    const symptoms = opts.symptoms || [];
    const reportedMonths = Number(opts.missedMonths || 0);
    const s = summarize(periods, today);

    if (!s.last && !reportedMonths) {
      return {
        level: "info",
        title: "Log your first period to get started",
        messages: ["Add the start date of your last period. The more cycles you log, the better the predictions and alerts."],
        stats: s,
        flags: {},
      };
    }

    // Days without a period: from the log, or what the user reported.
    const ongoing = s.last && !s.last.end && s.daysSinceLastStart <= 10;
    const fromLog = s.last && !ongoing ? s.daysSinceLastStart : 0;
    const effectiveDays = Math.max(fromLog, reportedMonths * 30);

    // Pattern of irregular cycles (normal adult cycle is about 21-35 days).
    const cl = s.cycles;
    const outOfRange = cl.filter((x) => x > 35 || x < 21).length;
    const spread = cl.length >= 3 ? Math.max(...cl) - Math.min(...cl) : 0;
    const irregularPattern = (cl.length >= 2 && outOfRange >= 2) || spread >= 20;

    const irregularOvulation = effectiveDays > 35 || irregularPattern;
    const androgen = symptoms.filter((k) => ANDROGEN_SIGNS.includes(k)).length;
    const metabolic = symptoms.filter((k) => METABOLIC_SIGNS.includes(k)).length;
    const familyHistory = symptoms.includes("familyHistory");
    const pcosPossible =
      irregularOvulation && (androgen >= 1 || metabolic >= 2 || (metabolic >= 1 && familyHistory));

    let level = "ok";
    const bump = (l) => { if (RANK[l] > RANK[level]) level = l; };
    if (effectiveDays >= 90) bump("alert");
    else if (effectiveDays > 60) bump("warn");
    else if (effectiveDays > 35) bump("watch");
    if (irregularPattern) bump("watch");
    if (pcosPossible) bump("alert");

    const messages = [];
    if (effectiveDays > 35) {
      messages.push(
        reportedMonths * 30 > fromLog
          ? `You reported about ${reportedMonths} month(s) without a period.`
          : `It has been ${effectiveDays} days since your last period started.`
      );
    }
    if (irregularPattern) {
      messages.push(`Your logged cycles (${cl.slice(-6).join(", ")} days) are irregular. A typical cycle is 21 to 35 days.`);
    }
    if (pcosPossible) {
      messages.push(
        "Irregular or missed periods together with the symptoms you selected can be a sign of PCOS/PCOD (polycystic ovary syndrome/disease). Only a doctor can confirm this, usually with a blood test and an ultrasound."
      );
    } else if (effectiveDays >= 90) {
      messages.push("Going 3 months or more without a period needs a medical check-up. PCOS/PCOD is one common cause.");
    } else if (irregularOvulation) {
      messages.push("Irregular cycles can have many causes, including PCOS/PCOD, thyroid problems, stress and weight changes. Tick any symptoms below that apply to you.");
    }
    if (effectiveDays > 35) {
      messages.push("If there is any chance you could be pregnant, take a pregnancy test first.");
    }

    let title;
    if (pcosPossible) title = "Possible PCOS/PCOD: please see a gynaecologist";
    else if (level === "alert") title = "No period for 3+ months: please get checked";
    else if (level === "warn") title = "Your period is more than 2 months late";
    else if (level === "watch") title = irregularPattern && effectiveDays <= 35 ? "Your cycles look irregular" : "Your period is late";
    else title = "Your cycle looks regular";

    if (level === "ok") {
      messages.push(
        s.daysToNext !== null
          ? s.daysToNext >= 0
            ? `Next period expected in about ${s.daysToNext} day(s) (${s.predictedNext}).`
            : `Your period was expected ${-s.daysToNext} day(s) ago.`
          : "Keep logging to build predictions."
      );
    }

    return {
      level,
      title,
      messages,
      stats: s,
      flags: { irregularOvulation, irregularPattern, androgen, metabolic, pcosPossible, effectiveDays },
    };
  }

  const api = { parseISO, toISO, diffDays, addDays, sortPeriods, cycleLengths, periodLengths, summarize, assess };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PT = api;
})(typeof window !== "undefined" ? window : globalThis);
