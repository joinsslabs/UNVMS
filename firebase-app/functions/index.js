// Server functions for UN House Access Control.
// - auditVisitors: tamper-proof audit trail for every visitor change
// - visitorEmails: host arrival alerts, "waiting at reception" alerts, approval requests and decisions
// - dailyReport: morning summary email to administrators and approvers
// - retention: deletes visit records older than RETENTION_DAYS (after check-out)
//
// Email is sent over SMTP. Set the account once with:
//   firebase.cmd functions:secrets:set SMTP_USER   (the sending address)
//   firebase.cmd functions:secrets:set SMTP_PASS   (its app password)
// Optional settings live in functions/.env (SMTP_HOST, SMTP_PORT, APP_URL, RETENTION_DAYS).

const { onDocumentWrittenWithAuthContext } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { defineSecret, defineString, defineInt } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

initializeApp();
const db = getFirestore();
const REGION = "europe-west1";
const SMTP_USER = defineSecret("SMTP_USER");
const SMTP_PASS = defineSecret("SMTP_PASS");
const SMTP_HOST = defineString("SMTP_HOST", { default: "smtp.gmail.com" });
const SMTP_PORT = defineInt("SMTP_PORT", { default: 465 });
const APP_URL = defineString("APP_URL", { default: "https://unhouse-vms-abj26.web.app/app.html" });
const RETENTION_DAYS = defineInt("RETENTION_DAYS", { default: 365 });
const TZ = "Africa/Lagos";

/* ---------------- audit trail ---------------- */
const TRACKED = ["status", "tag", "tagReturned", "host", "hostEmail", "building", "expected", "accessFrom", "accessTo",
  "decidedByUid", "hostNotified", "idType", "name", "org", "purpose", "restricted", "type"];

exports.auditVisitors = onDocumentWrittenWithAuthContext(
  { document: "visitors/{visitorId}", region: REGION },
  async (event) => {
    const before = event.data.before.exists ? event.data.before.data() : null;
    const after = event.data.after.exists ? event.data.after.data() : null;
    const rec = after || before || {};
    const changes = {};
    for (const k of TRACKED) {
      const a = before ? before[k] ?? null : null;
      const b = after ? after[k] ?? null : null;
      if (JSON.stringify(a) !== JSON.stringify(b)) changes[k] = { from: a, to: b };
    }
    // Writes made only by the email function (mail status) are not audited as staff actions.
    if (before && after && Object.keys(changes).length === 0 &&
        JSON.stringify(before.log) === JSON.stringify(after.log)) return;

    const actorUid = event.authId || null;
    let actor = null;
    if (actorUid && event.authType === "app_user") {
      const s = await db.doc(`staff/${actorUid}`).get();
      if (s.exists) actor = { name: s.get("name"), role: s.get("role"), email: s.get("email") };
    }
    const lastLog = after && Array.isArray(after.log) ? after.log[after.log.length - 1] : null;
    await db.collection("audit").add({
      at: FieldValue.serverTimestamp(),
      visitorId: event.params.visitorId,
      ref: rec.ref || event.params.visitorId,
      visitorName: rec.name || "",
      example: rec.example === true,
      action: !before ? "created" : !after ? "deleted" : "updated",
      statusFrom: before ? before.status ?? null : null,
      statusTo: after ? after.status ?? null : null,
      changes,
      actorUid,
      actorType: event.authType || "unknown",
      actor,
      clientNote: lastLog ? String(lastLog.a || "") : null,
      clientNoteMatchesActor: lastLog ? lastLog.byUid === actorUid : null,
    });
  }
);

/* ---------------- email ---------------- */
let transport;
function mailer() {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: SMTP_HOST.value(), port: SMTP_PORT.value(), secure: SMTP_PORT.value() === 465,
      auth: { user: SMTP_USER.value(), pass: SMTP_PASS.value() },
    });
  }
  return transport;
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const time = (ms) => ms ? new Date(ms).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "";
const validEmail = (e) => typeof e === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function page(title, lines, button) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;color:#1b2537">
  <div style="background:#1e2f52;color:#fff;padding:12px 16px;font-weight:bold">UN House Access Control</div>
  <div style="padding:16px;border:1px solid #d8dee9;border-top:0">
  <h2 style="margin:0 0 12px;font-size:18px">${esc(title)}</h2>
  ${lines.map(([k, v]) => `<p style="margin:4px 0"><span style="color:#5b6679">${esc(k)}:</span> <b>${esc(v)}</b></p>`).join("")}
  ${button ? `<p style="margin:18px 0 0"><a href="${esc(button[1])}" style="background:#1f6fd1;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none;font-weight:bold">${esc(button[0])}</a></p>` : ""}
  <p style="margin:18px 0 0;font-size:12px;color:#5b6679">Automatic message from the UN House visitor system. Do not reply.</p></div></div>`;
}

async function send(to, subject, html) {
  await mailer().sendMail({ from: `"UN House Access Control" <${SMTP_USER.value()}>`, to, subject, html });
}

async function staffEmails(roles) {
  const s = await db.collection("staff").where("role", "in", roles).where("active", "==", true).get();
  return s.docs.map((d) => d.get("email")).filter(validEmail);
}

exports.visitorEmails = onDocumentWrittenWithAuthContext(
  { document: "visitors/{visitorId}", region: REGION, secrets: [SMTP_USER, SMTP_PASS] },
  async (event) => {
    const before = event.data.before.exists ? event.data.before.data() : null;
    const v = event.data.after.exists ? event.data.after.data() : null;
    if (!v || v.example === true) return;
    const ref = event.data.after.ref;
    const visitLines = [["Visitor", v.name], ["Organisation", v.org || "—"], ["Reference", v.ref], ["Purpose", v.purpose || "—"]];
    const jobs = [];

    // 1. Host alerts: arrival at the gate (or VIP admitted), and "waiting at reception" when reception presses Notify.
    const arrived = before && before.status !== v.status && (v.status === "arrived" || (v.type === "vip" && v.status === "in"));
    const waiting = before && !before.hostNotified && v.hostNotified;
    if ((arrived || waiting) && validEmail(v.hostEmail)) {
      const subject = waiting ? `${v.name} is waiting for you at reception` : `${v.name} has arrived at UN House`;
      const title = waiting ? "Your visitor is waiting at internal reception" : (v.type === "vip" ? "Your VIP guest has been admitted" : "Your visitor has arrived at the gate");
      jobs.push(send(v.hostEmail, subject, page(title, [...visitLines, ["Time", time(v.hostNotified || v.arrivedAt || Date.now())]]))
        .then(() => ref.update({ mail: { status: "sent", kind: waiting ? "waiting" : "arrival", to: v.hostEmail, at: Date.now() } }))
        .catch((e) => ref.update({ mail: { status: "failed", kind: waiting ? "waiting" : "arrival", to: v.hostEmail, at: Date.now(), error: String(e.message).slice(0, 200) } })));
    }

    // 2. Approval request: new pending request → approvers and admins (not the requester).
    const newlyPending = v.status === "pending" && (!before || before.status !== "pending");
    if (newlyPending) {
      const requester = v.requestedByUid ? (await db.doc(`staff/${v.requestedByUid}`).get()).get("email") : null;
      const to = (await staffEmails(["approver", "admin"])).filter((e) => e !== requester);
      if (to.length) jobs.push(send(to.join(","), `Approval needed: ${v.name} (${v.type})`,
        page("A visit needs your approval", [...visitLines, ["Type", v.type], ["Host", v.host], ["Requested by", v.requestedBy || "—"]],
          ["Open approvals", APP_URL.value()])).catch(() => {}));
    }

    // 3. Decision: tell the requester.
    const decided = before && before.status === "pending" && ["approved", "rejected"].includes(v.status);
    if (decided && v.requestedByUid) {
      const requester = (await db.doc(`staff/${v.requestedByUid}`).get()).get("email");
      if (validEmail(requester)) jobs.push(send(requester, `${v.status === "approved" ? "Approved" : "Not approved"}: ${v.name}`,
        page(`Your request was ${v.status}`, [...visitLines, ["Decided by", v.decidedBy || "—"]], ["Open the system", APP_URL.value()])).catch(() => {}));
    }
    // 4. Digital pass: when a visit becomes approved and the visitor gave an email, create a pass and send the link.
    const nowApproved = v.status === "approved" && (!before || before.status !== "approved");
    if (nowApproved && validEmail(v.visitorEmail)) {
      jobs.push((async () => {
        const existing = await db.collection("passes").where("visitorId", "==", event.params.visitorId).where("revoked", "==", false).limit(1).get();
        let code = existing.empty ? null : existing.docs[0].id;
        if (!code) {
          code = require("crypto").randomBytes(20).toString("hex");
          const end = new Date(v.expected || Date.now()); end.setUTCHours(22, 59, 59, 0); // 23:59:59 Lagos
          await db.doc(`passes/${code}`).set({ visitorId: event.params.visitorId, ref: v.ref, name: v.name, org: v.org || "", host: v.host || "",
            agency: v.agency || "", type: v.type, building: v.building || "", expected: v.expected || Date.now(),
            validUntil: v.type === "contractor" && v.accessTo ? v.accessTo : Math.max(end.getTime(), Date.now() + 3600e3),
            status: v.status, tag: "", arrivedAt: null, inAt: null, outAt: null, requestedByUid: v.requestedByUid || "",
            createdAt: Date.now(), createdBy: "system", revoked: false });
        }
        const link = APP_URL.value() + "?pass=" + code;
        const when = new Date(v.expected || Date.now()).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ });
        await send(v.visitorEmail, "Your visitor pass for UN House Abuja",
          page(`Your visit on ${when}`, [["Host", v.host], ["Reference", v.ref], ["Bring", "A photo ID"]], ["Open my pass", link]));
      })().catch(() => {}));
    }
    await Promise.all(jobs);
  }
);

/* ---------------- daily report (07:00 Lagos time) ---------------- */
exports.dailyReport = onSchedule(
  { schedule: "0 7 * * *", timeZone: TZ, region: REGION, secrets: [SMTP_USER, SMTP_PASS] },
  async () => {
    const since = Date.now() - 24 * 3600e3;
    const all = (await db.collection("visitors").where("expected", ">=", since - 7 * 24 * 3600e3).get()).docs.map((d) => d.data()).filter((v) => !v.example);
    const yesterday = all.filter((v) => (v.arrivedAt || 0) >= since);
    const onSite = (await db.collection("visitors").where("status", "==", "in").get()).docs.map((d) => d.data()).filter((v) => !v.example);
    const pending = (await db.collection("visitors").where("status", "==", "pending").get()).size;
    const tagsOut = onSite.filter((v) => v.tag).length;
    const byAgency = {};
    yesterday.forEach((v) => { byAgency[v.agency || "Other"] = (byAgency[v.agency || "Other"] || 0) + 1; });
    const to = await staffEmails(["admin", "approver"]);
    if (!to.length) return;
    await send(to.join(","), `UN House daily visitor report`, page("Last 24 hours", [
      ["Arrivals", String(yesterday.length)],
      ["Still on site now", String(onSite.length)],
      ["Tags not returned", String(tagsOut)],
      ["Pending approvals", String(pending)],
      ...Object.entries(byAgency).sort((a, b) => b[1] - a[1]).map(([a, n]) => [a, String(n)]),
    ], ["Open the dashboard", APP_URL.value()]));
  }
);

/* ---------------- retention (02:00 daily) ---------------- */
exports.retention = onSchedule(
  { schedule: "0 2 * * *", timeZone: TZ, region: REGION },
  async () => {
    const cutoff = Date.now() - RETENTION_DAYS.value() * 24 * 3600e3;
    const old = await db.collection("visitors").where("expected", "<", cutoff).limit(400).get();
    const batch = db.batch(); let n = 0;
    old.docs.forEach((d) => { if (["out", "rejected"].includes(d.get("status"))) { batch.delete(d.ref); n++; } });
    if (n) await batch.commit();
    await db.collection("audit").add({ at: FieldValue.serverTimestamp(), action: "retention", deleted: n, cutoff, actorType: "system" });
  }
);

/* ---------------- AI assistant and handwriting reading (off until an admin enables them) ---------------- */
const { onRequest } = require("firebase-functions/v2/https");
const { getAuth } = require("firebase-admin/auth");
const crypto = require("crypto");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const GEMINI_MODEL = defineString("GEMINI_MODEL", { default: "gemini-2.0-flash" });
const BOOKING_API_KEY = defineSecret("BOOKING_API_KEY");
const ORIGINS = [/^https:\/\/unhouse-vms-abj26\.(web\.app|firebaseapp\.com)$/];

async function staffFromRequest(req) {
  const m = (req.get("Authorization") || "").match(/^Bearer (.+)$/);
  if (!m) return null;
  const tok = await getAuth().verifyIdToken(m[1]).catch(() => null);
  if (!tok) return null;
  const s = await db.doc(`staff/${tok.uid}`).get();
  if (!s.exists || s.get("active") !== true || s.get("role") === "pending") return null;
  return { uid: tok.uid, ...s.data() };
}
async function feature(name) {
  const f = await db.doc("config/features").get();
  return f.exists && f.get(name) === true;
}
async function gemini(parts, json) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL.value()}:generateContent`;
  const r = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_API_KEY.value() },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: json ? { responseMimeType: "application/json", temperature: 0 } : { temperature: 0.2 } }),
  });
  if (!r.ok) throw new Error(`AI service error ${r.status}`);
  const d = await r.json();
  return (d.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
}

exports.assistant = onRequest(
  { region: REGION, cors: ORIGINS, secrets: [GEMINI_API_KEY], maxInstances: 3 },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("POST only");
    const who = await staffFromRequest(req);
    if (!who || !["admin", "approver", "gate", "reception", "docs", "vip"].includes(who.role)) return res.status(403).json({ error: "Not allowed for your role." });
    if (!(await feature("ai"))) return res.status(403).json({ error: "The assistant is switched off. An administrator can turn it on in Staff & roles." });
    const q = String(req.body?.q || "").slice(0, 500);
    if (!q) return res.status(400).json({ error: "Ask a question." });
    const since = Date.now() - 3 * 24 * 3600e3;
    const recent = (await db.collection("visitors").where("expected", ">=", since).get()).docs.map((d) => d.data());
    const active = (await db.collection("visitors").where("status", "in", ["in", "tagged", "pending", "suspended"]).get()).docs.map((d) => d.data());
    const rows = recent.concat(active)
      .filter((v, i, a) => !v.example && a.findIndex((x) => x.ref === v.ref) === i)
      .map((v) => ({ ref: v.ref, name: v.name, org: v.org, type: v.type, host: v.host, agency: v.agency, building: v.building, status: v.status, tag: v.tag,
        expected: v.expected && new Date(v.expected).toISOString(), inAt: v.inAt && new Date(v.inAt).toISOString(), accessTo: v.accessTo && new Date(v.accessTo).toISOString(), purpose: v.purpose }));
    const prompt = `You are the operations assistant for the UN House Abuja visitor system. Time now: ${new Date().toISOString()} (Lagos is UTC+1). Overstay threshold: 9 hours.
Answer the officer's question using ONLY these records. Be brief and factual, plain text, short lines, include reference numbers. If the records do not answer it, say so.
RECORDS: ${JSON.stringify(rows)}
QUESTION: ${q}`;
    try {
      const text = await gemini([{ text: prompt }], false);
      await db.collection("audit").add({ at: FieldValue.serverTimestamp(), action: "assistant-query", actorUid: who.uid, actor: { name: who.name, role: who.role, email: who.email }, question: q, actorType: "app_user" });
      res.json({ text });
    } catch (e) { res.status(502).json({ error: e.message }); }
  }
);

exports.readList = onRequest(
  { region: REGION, cors: ORIGINS, secrets: [GEMINI_API_KEY], maxInstances: 3, memory: "512MiB" },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).send("POST only");
    const who = await staffFromRequest(req);
    if (!who || !["admin", "approver", "gate", "reception", "host"].includes(who.role)) return res.status(403).json({ error: "Not allowed for your role." });
    if (!(await feature("handwriting"))) return res.status(403).json({ error: "Handwritten list reading is switched off. An administrator can turn it on in Staff & roles." });
    const { mime, data } = req.body || {};
    if (!/^(image\/(png|jpeg|webp)|application\/pdf)$/.test(mime || "") || typeof data !== "string" || data.length > 9000000) return res.status(400).json({ error: "Send one image or PDF under 6 MB." });
    const prompt = `This is a visitor list for UN House Abuja, possibly handwritten. Extract one object per visitor row.
Return JSON: {"rows":[{"name":"","org":"","host":"","hostEmail":"","agency":"","type":"visitor|vip|contractor","expected":"YYYY-MM-DDTHH:MM or empty","purpose":"","uncertain":true}]}
Dates are day/month/year. Use empty strings for anything not written. Set uncertain to true when any word in the row is hard to read, otherwise false. Do not invent data.`;
    try {
      const out = await gemini([{ text: prompt }, { inline_data: { mime_type: mime, data } }], true);
      const rows = (JSON.parse(out).rows || []).slice(0, 200);
      await db.collection("audit").add({ at: FieldValue.serverTimestamp(), action: "handwriting-read", actorUid: who.uid, actor: { name: who.name, role: who.role, email: who.email }, rows: rows.length, actorType: "app_user" });
      res.json({ rows });
    } catch (e) { res.status(502).json({ error: "The list could not be read: " + e.message }); }
  }
);

/* ---------------- booking-system API ----------------
   POST https://europe-west1-unhouse-vms-abj26.cloudfunctions.net/bookingApi
   Header: x-api-key: <BOOKING_API_KEY>
   Body: {"source":"Room booking","visitors":[{"name":"","org":"","host":"","hostEmail":"","agency":"","type":"visitor","expected":"2026-11-10T09:30","purpose":"","externalId":"BK-123"}]}
   Visitors (type "visitor") are registered as approved; VIPs and contractors go to Approvals.
   Re-sending the same externalId does not create a duplicate. */
exports.bookingApi = onRequest(
  { region: REGION, secrets: [BOOKING_API_KEY], maxInstances: 2 },
  async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
    const key = req.get("x-api-key") || "";
    const want = BOOKING_API_KEY.value();
    if (!want || key.length !== want.length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(want))) return res.status(401).json({ error: "Invalid API key" });
    const list = Array.isArray(req.body?.visitors) ? req.body.visitors.slice(0, 200) : null;
    if (!list) return res.status(400).json({ error: "Body must contain a visitors array" });
    const source = String(req.body.source || "Booking system").slice(0, 60);
    const results = [];
    for (const raw of list) {
      const name = String(raw.name || "").trim().slice(0, 120), host = String(raw.host || "").trim().slice(0, 120);
      const ext = String(raw.externalId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
      if (!name || !host) { results.push({ externalId: ext, error: "name and host are required" }); continue; }
      const type = ["vip", "contractor"].includes(raw.type) ? raw.type : "visitor";
      const expected = Date.parse(raw.expected) || Date.now();
      const d = new Date(expected), pad = (n) => String(n).padStart(2, "0");
      const ref = ext ? `UNH-BK-${ext}` : `UNH-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const docRef = db.collection("visitors").doc(ref);
      if (ext && (await docRef.get()).exists) { results.push({ externalId: ext, ref, status: "already registered" }); continue; }
      const v = { id: ref, ref, name, org: String(raw.org || "").slice(0, 160), host, hostEmail: String(raw.hostEmail || "").toLowerCase().slice(0, 160),
        agency: String(raw.agency || "Common Services").slice(0, 60), type, expected, purpose: String(raw.purpose || "").slice(0, 300),
        building: "Main UN House Building", restricted: false, requestedBy: source, requestedByUid: "system:booking", externalId: ext,
        status: type === "visitor" ? "approved" : "pending",
        log: [{ t: Date.now(), a: `Registered by ${source} (API)`, by: source, byUid: "system:booking", role: "system", st: "API" }] };
      if (type === "contractor") { v.accessFrom = expected; v.accessTo = expected + 24 * 3600e3 - 1; }
      await docRef.set(v);
      results.push({ externalId: ext, ref, status: v.status });
    }
    res.json({ results });
  }
);
