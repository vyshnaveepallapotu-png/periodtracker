/* UI code. The screening rules live in logic.js (window.PT). */
(function () {
  "use strict";
  const KEY = "periodTracker.v1";
  const $ = (id) => document.getElementById(id);
  const todayISO = () => PT.toISO(new Date());

  // ---------- storage ----------
  function load() {
    const empty = { periods: [], symptoms: [], missedMonths: 0 };
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (!s || !Array.isArray(s.periods)) return empty;
      return {
        periods: s.periods,
        symptoms: Array.isArray(s.symptoms) ? s.symptoms : [],
        missedMonths: Number(s.missedMonths) || 0,
      };
    } catch (e) {
      return empty;
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked */ }
  }
  let state = load();

  // ---------- small DOM helper (uses textContent, so no HTML injection) ----------
  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    });
    kids.forEach((k) => k && n.append(k));
    return n;
  }

  // ---------- render: alert + stats ----------
  function renderSummary() {
    const today = todayISO();
    const r = PT.assess(state.periods, today, { symptoms: state.symptoms, missedMonths: state.missedMonths });
    const box = $("alertBox");
    box.className = "alert " + r.level;
    box.replaceChildren(el("h2", { text: r.title }));
    r.messages.forEach((m) => box.append(el("p", { text: m })));
    if (r.level === "watch" || r.level === "warn" || r.level === "alert") {
      box.append(
        el("button", { type: "button", text: "Find a gynaecologist near me", onclick: () => {
          $("hospitalSection").scrollIntoView({ behavior: "smooth" });
        } })
      );
    }

    const s = r.stats;
    const stat = (value, label) => el("div", { class: "stat" }, el("b", { text: value }), el("span", { text: label }));
    $("stats").replaceChildren(
      stat(s.avgCycle ? s.avgCycle.toFixed(0) + " days" : "–", "Average cycle"),
      stat(s.avgPeriod ? s.avgPeriod.toFixed(0) + " days" : "–", "Average period length"),
      stat(s.last ? s.last.start : "–", "Last period started"),
      stat(
        s.daysToNext === null ? "–" : s.daysToNext >= 0 ? "in " + s.daysToNext + " days" : -s.daysToNext + " days late",
        "Next period (estimate)"
      )
    );
  }

  // ---------- render: calendar ----------
  let view = new Date();
  view.setDate(1);

  function periodDaySet() {
    const set = new Set();
    const s = PT.summarize(state.periods, todayISO());
    const defLen = Math.round(s.avgPeriod || 5);
    state.periods.forEach((p) => {
      const end = p.end || PT.addDays(p.start, defLen - 1 > 9 ? 9 : defLen - 1);
      for (let d = p.start; d <= end; d = PT.addDays(d, 1)) set.add(d);
    });
    return set;
  }
  function predictedDaySet() {
    const set = new Set();
    const s = PT.summarize(state.periods, todayISO());
    if (!s.last) return set;
    const cycle = Math.round(s.avgCycle || 28);
    const len = Math.round(s.avgPeriod || 5);
    for (let i = 1; i <= 4; i++) {
      const start = PT.addDays(s.last.start, cycle * i);
      for (let k = 0; k < len; k++) set.add(PT.addDays(start, k));
    }
    return set;
  }

  function renderCalendar() {
    const y = view.getFullYear(), m = view.getMonth();
    $("monthLabel").textContent = view.toLocaleString(undefined, { month: "long", year: "numeric" });
    const grid = $("calGrid");
    grid.replaceChildren();
    ["S", "M", "T", "W", "T", "F", "S"].forEach((d) => grid.append(el("div", { class: "dow", text: d })));
    const first = new Date(y, m, 1).getDay();
    const days = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < first; i++) grid.append(el("div"));
    const periodDays = periodDaySet(), predicted = predictedDaySet(), today = todayISO();
    for (let d = 1; d <= days; d++) {
      const iso = PT.toISO(new Date(y, m, d));
      let cls = "day";
      if (periodDays.has(iso)) cls += " period";
      else if (predicted.has(iso) && iso >= today) cls += " predicted";
      if (iso === today) cls += " today";
      grid.append(el("div", { class: cls, text: String(d) }));
    }
  }

  // ---------- render: history ----------
  function renderHistory() {
    const body = document.querySelector("#history tbody");
    body.replaceChildren();
    const rows = PT.sortPeriods(state.periods).reverse();
    if (!rows.length) {
      body.append(el("tr", {}, el("td", { colspan: "6", text: "No periods logged yet." })));
      return;
    }
    rows.forEach((p) => {
      const days = p.end ? PT.diffDays(p.start, p.end) + 1 : "ongoing";
      const actions = el("td");
      if (!p.end) {
        actions.append(
          el("button", { type: "button", class: "secondary", text: "Ended today", onclick: () => {
            const t = todayISO();
            p.end = t < p.start ? p.start : t;
            persist();
          } }),
          " "
        );
      }
      actions.append(
        el("button", { type: "button", class: "danger", text: "Delete", onclick: () => {
          state.periods = state.periods.filter((x) => x.id !== p.id);
          persist();
        } })
      );
      body.append(
        el("tr", {}, el("td", { text: p.start }), el("td", { text: p.end || "–" }), el("td", { text: String(days) }),
          el("td", { text: p.flow || "" }), el("td", { text: p.notes || "" }), actions)
      );
    });
  }

  function persist() {
    save();
    renderAll();
  }
  function renderAll() {
    renderSummary();
    renderCalendar();
    renderHistory();
  }

  // ---------- form: log a period ----------
  $("startDate").max = todayISO();
  $("endDate").max = todayISO();
  $("logForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = $("formMsg");
    msg.className = "msg";
    const start = $("startDate").value, end = $("endDate").value || null;
    if (!start) { msg.textContent = "Please choose a start date."; return; }
    if (start > todayISO()) { msg.textContent = "Start date cannot be in the future."; return; }
    if (end && end < start) { msg.textContent = "End date cannot be before the start date."; return; }
    if (end && PT.diffDays(start, end) > 14) { msg.textContent = "A period longer than 15 days is unusual. Please check the dates."; return; }
    if (state.periods.some((p) => p.start === start)) { msg.textContent = "You already logged a period starting on this date."; return; }
    state.periods.push({
      id: Date.now() + Math.random(),
      start, end,
      flow: $("flow").value,
      notes: $("notes").value.trim().slice(0, 120),
    });
    $("logForm").reset();
    persist();
    msg.className = "msg good";
    msg.textContent = "Saved.";
    setTimeout(() => { if (msg.textContent === "Saved.") msg.textContent = ""; }, 2500);
  });

  // ---------- calendar nav ----------
  $("prevMonth").onclick = () => { view.setMonth(view.getMonth() - 1); renderCalendar(); };
  $("nextMonth").onclick = () => { view.setMonth(view.getMonth() + 1); renderCalendar(); };

  // ---------- symptoms ----------
  const checks = document.querySelectorAll("#symptoms input[type=checkbox]");
  function syncSymptomUI() {
    checks.forEach((c) => (c.checked = state.symptoms.includes(c.dataset.key)));
    $("missedMonths").value = String(state.missedMonths);
    if ($("missedMonths").value !== String(state.missedMonths)) $("missedMonths").value = "0";
  }
  checks.forEach((c) =>
    c.addEventListener("change", () => {
      state.symptoms = [...checks].filter((x) => x.checked).map((x) => x.dataset.key);
      persist();
    })
  );
  $("missedMonths").addEventListener("change", (e) => {
    state.missedMonths = Number(e.target.value) || 0;
    persist();
  });

  // ---------- export / delete ----------
  $("exportBtn").onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "period-tracker-data.json" });
    document.body.append(a);
    a.click();
    a.remove();
  };
  $("clearBtn").onclick = () => {
    if (confirm("Delete all your logged periods and symptom answers from this browser?")) {
      state = { periods: [], symptoms: [], missedMonths: 0 };
      persist();
      syncSymptomUI();
    }
  };

  // ---------- nearby gynaecologists / hospitals ----------
  const OVERPASS = "https://overpass-api.de/api/interpreter";
  const GYN_NAME = /gyn|women|woman|maternity|obstet|mother|matern|fertility|ivf|\bmahila\b|lady/i;
  let map = null, markerLayer = null;

  const toRad = (x) => (x * Math.PI) / 180;
  function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  async function queryOverpass(lat, lon, radius) {
    const q = `[out:json][timeout:25];(
      nwr["amenity"="hospital"](around:${radius},${lat},${lon});
      nwr["amenity"~"clinic|doctors"]["healthcare:speciality"~"gyn|obstet"](around:${radius},${lat},${lon});
      nwr["healthcare:speciality"~"gyn|obstet"](around:${radius},${lat},${lon});
    );out center tags 80;`;
    const res = await fetch(OVERPASS, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(q),
    });
    if (!res.ok) throw new Error("Overpass error " + res.status);
    const data = await res.json();
    const seen = new Set();
    const out = [];
    for (const e of data.elements || []) {
      const t = e.tags || {};
      const name = t.name || t["name:en"];
      const plat = e.lat ?? (e.center && e.center.lat), plon = e.lon ?? (e.center && e.center.lon);
      if (!name || plat == null || plon == null) continue;
      const k = name.toLowerCase() + "|" + plat.toFixed(3) + "|" + plon.toFixed(3);
      if (seen.has(k)) continue;
      seen.add(k);
      const spec = (t["healthcare:speciality"] || "") + " " + name;
      out.push({
        name, lat: plat, lon: plon,
        km: distanceKm(lat, lon, plat, plon),
        gyn: /gyn|obstet/i.test(t["healthcare:speciality"] || "") || GYN_NAME.test(spec),
        phone: t.phone || t["contact:phone"] || "",
        addr: [t["addr:street"], t["addr:suburb"] || t["addr:city"]].filter(Boolean).join(", "),
      });
    }
    // gynaecology-related first, then nearest
    out.sort((a, b) => (b.gyn - a.gyn) || (a.km - b.km));
    return out.slice(0, 12);
  }

  function renderHospitals(lat, lon, list, radiusKm) {
    $("gmapsLink").href = `https://www.google.com/maps/search/?api=1&query=gynecologist+near+${lat},${lon}`;
    const ul = $("hospList");
    ul.replaceChildren();
    if (!list.length) {
      $("hospMsg").className = "msg";
      $("hospMsg").textContent = `No results within ${radiusKm} km in OpenStreetMap. Try the Google Maps link below.`;
    } else {
      $("hospMsg").className = "msg good";
      $("hospMsg").textContent = `Showing ${list.length} places near you, closest women's health facilities first.`;
    }
    list.forEach((h) => {
      const title = el("div", { class: "name", text: h.name });
      if (h.gyn) title.append(el("span", { class: "badge", text: "Women's health" }));
      const meta = [`${h.km.toFixed(1)} km away`, h.addr, h.phone].filter(Boolean).join(" · ");
      const dir = el("a", {
        href: `https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lon}`,
        target: "_blank", rel: "noopener", text: "Directions",
      });
      ul.append(el("li", {}, el("div", {}, title, el("div", { class: "meta", text: meta })), dir));
    });

    // map (optional: needs the Leaflet CDN script)
    const mapDiv = $("map");
    if (typeof L === "undefined") { mapDiv.hidden = true; return; }
    mapDiv.hidden = false;
    if (!map) {
      map = L.map(mapDiv);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19, attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      markerLayer = L.layerGroup().addTo(map);
    }
    markerLayer.clearLayers();
    const pts = [[lat, lon]];
    L.circleMarker([lat, lon], { radius: 8, color: "#1565c0" }).addTo(markerLayer).bindPopup("You are here");
    list.forEach((h) => {
      const pop = document.createElement("div");
      pop.textContent = h.name;
      L.marker([h.lat, h.lon]).addTo(markerLayer).bindPopup(pop);
      pts.push([h.lat, h.lon]);
    });
    map.invalidateSize();
    map.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
  }

  async function searchNear(lat, lon) {
    const msg = $("hospMsg");
    msg.className = "msg";
    msg.textContent = "Searching nearby…";
    try {
      let radius = 10000;
      let list = await queryOverpass(lat, lon, radius);
      if (list.length < 3) { radius = 25000; list = await queryOverpass(lat, lon, radius); }
      renderHospitals(lat, lon, list, radius / 1000);
    } catch (err) {
      msg.textContent = "Could not load results (check your internet connection). You can still use the Google Maps link below.";
      $("gmapsLink").href = `https://www.google.com/maps/search/?api=1&query=gynecologist+near+${lat},${lon}`;
    }
  }

  $("locateBtn").onclick = () => {
    const msg = $("hospMsg");
    if (!navigator.geolocation) { msg.className = "msg"; msg.textContent = "Location is not supported here. Type your area instead."; return; }
    msg.className = "msg";
    msg.textContent = "Getting your location…";
    navigator.geolocation.getCurrentPosition(
      (pos) => searchNear(pos.coords.latitude, pos.coords.longitude),
      () => { msg.textContent = "Location permission was denied or unavailable. Type your area or city instead."; },
      { enableHighAccuracy: false, timeout: 15000 }
    );
  };

  $("searchBtn").onclick = async () => {
    const q = $("placeInput").value.trim();
    const msg = $("hospMsg");
    if (!q) { msg.className = "msg"; msg.textContent = "Type an area or city first."; return; }
    msg.className = "msg";
    msg.textContent = "Finding that place…";
    try {
      const res = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(q));
      const data = await res.json();
      if (!data.length) { msg.textContent = "Could not find that place. Try a bigger area name."; return; }
      await searchNear(parseFloat(data[0].lat), parseFloat(data[0].lon));
    } catch (e) {
      msg.textContent = "Could not look up that place (check your internet connection).";
    }
  };
  $("placeInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("searchBtn").click(); });

  // ---------- start ----------
  syncSymptomUI();
  renderAll();
})();
