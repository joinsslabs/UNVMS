'use strict';
const nodemailer = require('nodemailer');
const config = require('./config');
const { db } = require('./db');

let transport = null;
if (config.smtp.host) {
  transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

const insOutbox = db.prepare('INSERT INTO outbox(to_addr, subject, body, status, error, visit_id) VALUES (?,?,?,?,?,?)');

/**
 * Send an email. Never throws: failures are recorded in the outbox so the
 * front desk is never blocked by the mail server. Without SMTP configured,
 * messages are recorded as 'logged' (visible under Admin → Email log).
 */
async function sendMail({ to, subject, text, visitId = null }) {
  if (!to) return { status: 'skipped' };
  if (!transport) {
    insOutbox.run(to, subject, text, 'logged', null, visitId);
    console.log(`[mail:logged] to=${to} subject="${subject}"`);
    return { status: 'logged' };
  }
  try {
    await transport.sendMail({ from: config.smtp.from, to, subject, text });
    insOutbox.run(to, subject, text, 'sent', null, visitId);
    return { status: 'sent' };
  } catch (e) {
    insOutbox.run(to, subject, text, 'failed', String(e.message || e).slice(0, 500), visitId);
    console.error('[mail:failed]', e.message);
    return { status: 'failed' };
  }
}

const fmtTime = iso => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function hostArrivalEmail(visit, host) {
  const place = visit.gate === 'vip' ? 'VIP gate' : 'Main Building reception';
  return {
    to: host.email,
    visitId: visit.id,
    subject: `Your visitor ${visit.visitor_name} has arrived`,
    text:
`Dear ${host.name},

Your ${visit.visitor_type === 'vip' ? 'VIP ' : ''}visitor has arrived at the ${place} and is waiting for you.

  Visitor:      ${visit.visitor_name}${visit.organization ? ` (${visit.organization})` : ''}
  Visitor tag:  ${visit.tag_number || '-'}
  Arrived:      ${fmtTime(visit.arrived_main_at || new Date().toISOString())}
  Reference:    ${visit.ref}

Please come to the ${place} to receive your guest.

${config.orgName} — Visitor Management
${config.publicUrl}
`,
  };
}

function visitorInvitationEmail(visit, host, meeting) {
  const when = visit.expected_at.replace('T', ' at ');
  return {
    to: visit.email,
    visitId: visit.id,
    subject: `Your visit to ${config.orgName} — ${when}`,
    text:
`Dear ${visit.visitor_name},

You are expected at ${config.orgName} on ${when}${meeting ? ` for "${meeting.title}" (${meeting.room})` : host ? `, hosted by ${host.name}` : ''}.

  Visit reference: ${visit.ref}

On arrival, please go to the Access Control building reception and give your name.
Bring a valid Nigerian government-issued photo ID (NIN slip/card, driver's licence,
international passport or voter's card). It will be held at the Documentation desk
in exchange for a visitor tag and returned when you leave.

${config.orgName} — Visitor Management
`,
  };
}

function approvalNeededEmail(visit, approver) {
  return {
    to: approver.email,
    visitId: visit.id,
    subject: `Approval needed: ${visit.visitor_name} (${visit.visitor_type.replace('_', '-')})`,
    text:
`Dear ${approver.name},

A visit is waiting for approval:

  Visitor:   ${visit.visitor_name}${visit.organization ? ` (${visit.organization})` : ''}
  Type:      ${visit.visitor_type}
  Expected:  ${visit.expected_at.replace('T', ' ')}
  Reference: ${visit.ref}

Open the dashboard to approve or reject: ${config.publicUrl}/admin.html

${config.orgName} — Visitor Management
`,
  };
}

module.exports = { sendMail, hostArrivalEmail, visitorInvitationEmail, approvalNeededEmail, enabled: () => !!transport };
