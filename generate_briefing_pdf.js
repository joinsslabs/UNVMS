const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 45, bottom: 50, left: 50, right: 50 },
  bufferPages: true,
  info: {
    Title: 'UN House Abuja - Visitor Management System Technical Briefing',
    Author: 'SKILL.SCH',
    Subject: 'IT Integration & Operational Deployment Guide',
    Keywords: 'UNDSS, UN House, VMS, BOS 2.0, IT Integration'
  }
});

const outputPath = path.join(__dirname, 'UN_House_VMS_IT_Integration_Briefing.pdf');
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// Color Palette
const C_NAVY = '#0f172a';
const C_UN_BLUE = '#0077b6';
const C_DARK_BLUE = '#1e3a8a';
const C_SLATE = '#475569';
const C_LIGHT_SLATE = '#64748b';
const C_BG_LIGHT = '#f8fafc';
const C_LINE = '#e2e8f0';
const C_GREEN = '#15803d';
const C_AMBER = '#b45309';

// Helpers
function drawHeader(title) {
  doc.rect(50, 40, doc.page.width - 100, 2).fill(C_UN_BLUE);
  doc.fontSize(8).fillColor(C_LIGHT_SLATE).font('Helvetica-Bold')
    .text('UNITED NATIONS HOUSE ABUJA · COMMON SERVICES & UNDSS', 50, 26, { align: 'left' });
  doc.fontSize(8).fillColor(C_LIGHT_SLATE).font('Helvetica')
    .text(title || 'TECHNICAL INTEGRATION & DEPLOYMENT BRIEFING', 50, 26, { align: 'right' });
  doc.y = 55;
}

function sectionTitle(num, title) {
  if (doc.y > 670) doc.addPage();
  doc.moveDown(0.8);
  const y = doc.y;
  doc.rect(50, y, 4, 18).fill(C_UN_BLUE);
  doc.fontSize(12).fillColor(C_DARK_BLUE).font('Helvetica-Bold')
    .text(`${num}. ${title.toUpperCase()}`, 62, y + 2);
  doc.moveDown(0.6);
}

function subTitle(title) {
  if (doc.y > 700) doc.addPage();
  doc.fontSize(10).fillColor(C_NAVY).font('Helvetica-Bold').text(title);
  doc.moveDown(0.3);
}

function bodyText(text) {
  doc.fontSize(9).fillColor(C_SLATE).font('Helvetica').text(text, { lineGap: 2.5 });
  doc.moveDown(0.4);
}

function callout(title, text, type = 'info') {
  if (doc.y > 680) doc.addPage();
  const y = doc.y;
  const borderColor = type === 'success' ? C_GREEN : (type === 'warn' ? C_AMBER : C_UN_BLUE);
  const bgColor = type === 'success' ? '#f0fdf4' : (type === 'warn' ? '#fffbeb' : '#f0f9ff');
  
  doc.rect(50, y, doc.page.width - 100, 48).fillAndStroke(bgColor, '#e2e8f0');
  doc.rect(50, y, 4, 48).fill(borderColor);
  
  doc.fontSize(9).fillColor(borderColor).font('Helvetica-Bold')
    .text(title, 64, y + 8);
  doc.fontSize(8.5).fillColor(C_NAVY).font('Helvetica')
    .text(text, 64, y + 22, { width: doc.page.width - 130, lineGap: 2 });
  doc.y = y + 54;
}

// ==================== COVER / PAGE 1 ====================
// Top UN Emblem Banner
doc.rect(0, 0, doc.page.width, 160).fill('#0f1a30');
doc.rect(0, 156, doc.page.width, 4).fill(C_UN_BLUE);

doc.fillColor('#ffffff').fontSize(11).font('Helvetica-Bold')
  .text('UNITED NATIONS COMMON SERVICES · NIGERIA', 50, 42, { characterSpacing: 1 });
doc.fontSize(22).font('Helvetica-Bold')
  .text('UN House Visitor Management System (UNVMS)', 50, 60);
doc.fontSize(11).font('Helvetica')
  .fillColor('#94a3b8')
  .text('Technical Architecture, IT Integration Scope & Compound Deployment Guide', 50, 92);

doc.rect(50, 116, 210, 24).fillAndStroke('rgba(255,255,255,0.12)', '#38bdf8');
doc.fontSize(8.5).fillColor('#e0f2fe').font('Helvetica-Bold')
  .text('🛡️ UNDSS Security Level 2 · UN BOS 2.0', 58, 122);

doc.rect(270, 116, 200, 24).fillAndStroke('rgba(255,255,255,0.12)', '#38bdf8');
doc.fontSize(8.5).fillColor('#e0f2fe').font('Helvetica-Bold')
  .text('⚡ Live Build · Engineered by SKILL.SCH', 278, 122);

doc.y = 180;

// Executive Summary
sectionTitle('1', 'Executive Summary');
bodyText('The UN House Abuja Visitor Management System (UNVMS) is an integrated digital platform engineered to modernize, secure, and streamline compound physical access under the UN Business Operations Strategy (BOS 2.0) and UNDSS physical security directives.');
bodyText('UN House Abuja accommodates 20+ resident UN agencies (including UNDP, WHO, UNICEF, WFP, UNAIDS, UNODC, and UNESCO) at Plot 617/618 Diplomatic Drive. This briefing outlines the exact technical mechanisms in place, confirms what is 100% operational out of the box, and defines the exact, minimal footprint where UN ICT intervention is optional or beneficial.');

callout(
  'KEY TAKEAWAY FOR ICT & EXECUTIVE MANAGEMENT',
  'UNVMS is fully functional today without creating new emails, without complex database integrations, and without administrative roadblocks. Staff use their existing official UN email inboxes, visitors need zero accounts, and checkpoint officers authenticate securely.',
  'success'
);

// Operational Model
sectionTitle('2', '4-Station Compound Access Pipeline');
bodyText('The system enforces a strict 4-station physical and visual verification pipeline:');

const stations = [
  { s: 'Station 1 · Gate Clearance', d: 'Vehicle and preliminary pedestrian credential verification. Rapid lookup against pre-approved guest invitations and security watchlists.' },
  { s: 'Station 2 · Documentation & Tagging', d: 'Physical ID capture, baggage screening declaration, visual biometric photo capture, and physical badge / visitor pass assignment.' },
  { s: 'Station 3 · Main Reception Check-In', d: 'Final reception clearance, automated arrival alert dispatch to host agency staff via Outlook inbox and WhatsApp, and badge activation.' },
  { s: 'Station 4 · Exit Checkout', d: 'Compound departure timestamping, visual badge surrender, and live evacuation muster list updating.' },
  { s: 'VIP Diplomatic Gate & Protocol Fast-Track', d: 'Dedicated expedited clearance workflow for Ambassadors, High Commissioners, Heads of Agency, and Federal Ministers.' }
];

stations.forEach(st => {
  const y = doc.y;
  doc.circle(58, y + 6, 3).fill(C_UN_BLUE);
  doc.fontSize(9).font('Helvetica-Bold').fillColor(C_NAVY).text(st.s, 68, y);
  doc.fontSize(8.5).font('Helvetica').fillColor(C_SLATE).text(st.d, 68, y + 12, { lineGap: 1.5 });
  doc.moveDown(0.4);
});

// ==================== PAGE 2 ====================
doc.addPage();
drawHeader('IT FOOTPRINT & AUTHENTICATION ARCHITECTURE');

sectionTitle('3', 'Authentication Model: Zero New Email Accounts');
bodyText('A central design mandate is that NO staff member, security officer, or guest is ever required to create or maintain a secondary email address.');

subTitle('A. Official UN Staff & Host Officers (Passwordless Magic Link)');
bodyText('• Staff enter their official UN work email (e.g. name@undp.org or name@un.org).\n• A secure, single-use, 15-minute cryptographic sign-in link is dispatched directly into their Microsoft Outlook / M365 inbox.\n• Clicking the link in Outlook automatically authenticates them into their operations console.\n• Staff names and agency affiliations are automatically detected from their email and matched against the pre-loaded UN Staff Directory.');

subTitle('B. Station & Gate Security Officers');
bodyText('• Dedicated credentials for Station 1 (Gate), Station 2 (Search/ID), Station 3 (Reception), Station 4 (Exit), VIP Protocol, and UNDSS Field Security Supervisors (FSM).\n• Role-based access ensures officers only see tools relevant to their specific checkpoint.');

subTitle('C. External Visitors & Guests');
bodyText('• 100% tokenized web links (via SMS, WhatsApp, or invitation email).\n• Visitors never register, download apps, or remember passwords. They simply fill in arrival details and receive a digital QR pass.');

sectionTitle('4', 'Comprehensive IT Integration & Intervention Matrix');
bodyText('The table below summarizes every technical subsystem and details the exact level of UN ICT involvement:');

// Draw Table
const tableY = doc.y;
const colW = [120, 110, 110, 155];
const headers = ['System Component', 'Operational Status', 'IT Required?', 'Details / Action Required'];

// Table Header
doc.rect(50, tableY, doc.page.width - 100, 20).fill('#0f172a');
let curX = 54;
headers.forEach((h, i) => {
  doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#ffffff').text(h, curX, tableY + 6, { width: colW[i] - 8 });
  curX += colW[i];
});

let rowY = tableY + 20;
const rows = [
  ['Staff Sign-In (Magic Link)', 'Live & Verified', 'None (0%)', 'Dispatches directly to @undp.org or @un.org Outlook inboxes out of the box.'],
  ['Station 1-4 Operations', 'Live & Verified', 'None (0%)', 'Standalone web consoles operate on standard browsers (Chrome, Edge, Safari).'],
  ['Visitor Digital Passes', 'Live & Verified', 'None (0%)', 'Tokenized links with dynamic QR generation. No app store installation.'],
  ['QR / Camera Scanning', 'Live & Verified', 'None (0%)', 'Standard HTML5 browser cameras; standard USB 2D scanners act as keyboards.'],
  ['Host WhatsApp Alerts', 'Live & Verified', 'None (0%)', 'Uses 1-click wa.me direct dispatch without external server dependency.'],
  ['Email Spam Allowlisting', 'Recommended', 'Minor (5 min)', 'UN ICT mail admin adds sender domain to M365 Safe Senders to prevent Junk folder.'],
  ['Station Hardware & Wi-Fi', 'Deployment Task', 'Facilities/IT', 'Ensure security checkpoint tablets/laptops have compound Wi-Fi or 4G SIM.'],
  ['Custom Compound Domain', 'Optional', 'Minor (10 min)', 'DNS CNAME pointing (e.g. vms.unhouseabuja.org) if requested by leadership.'],
  ['Microsoft Entra ID (SSO)', 'Ready / Deferred', 'Optional', 'Popup SSO button preserved in code; ready for 1-click activation when tenant consents.']
];

rows.forEach((r, idx) => {
  const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
  doc.rect(50, rowY, doc.page.width - 100, 24).fillAndStroke(bg, C_LINE);
  curX = 54;
  r.forEach((val, i) => {
    const isBold = i === 0;
    const isAlert = i === 2 && val.includes('None');
    doc.fontSize(7.5).font(isBold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(isAlert ? C_GREEN : (i === 2 && val.includes('Minor') ? C_AMBER : C_NAVY))
      .text(val, curX, rowY + 6, { width: colW[i] - 8, lineGap: 1 });
    curX += colW[i];
  });
  rowY += 24;
});

doc.y = rowY + 14;

// ==================== PAGE 3 ====================
doc.addPage();
drawHeader('SECURITY, COMPLIANCE & PHYSICAL DEPLOYMENT');

sectionTitle('5', 'Security, Data Protection & BOS 2.0 Compliance');
bodyText('UNVMS is architected under strict adherence to the United Nations Principles on Personal Data Protection and Privacy:');

const points = [
  'Purpose Limitation: Visitor data (full name, phone, agency visited, badge number) is retained strictly for physical security, contact tracing, and emergency evacuation accountability.',
  'Data Minimization: No unnecessary sensitive personal information is requested or permanently stored.',
  'Encrypted in Transit & at Rest: All communication is encrypted via TLS 1.3 HTTPS; database entries and session credentials are encrypted in Google Firebase Cloud infrastructure.',
  'Accountability & Audit Trails: Every pass generation, station clearance, and watchlist check logs timestamped supervisor identifiers.',
  'Real-Time Evacuation Muster: In the event of compound alarm or drill, UNDSS supervisors can instantly generate the live count and identity of all visitors currently inside UN House.'
];

points.forEach(p => {
  const y = doc.y;
  doc.circle(58, y + 5, 2.5).fill(C_DARK_BLUE);
  const [b, ...rest] = p.split(':');
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C_NAVY).text(b + ':', 68, y, { continued: true });
  doc.font('Helvetica').fillColor(C_SLATE).text(rest.join(':'), { lineGap: 1.5 });
  doc.moveDown(0.3);
});

sectionTitle('6', 'Physical Checkpoint Deployment Checklist');
bodyText('To roll out the system across UN House Abuja gates, the operational team should complete these practical steps:');

const checklist = [
  { item: 'Checkpoint 1 (Vehicle Gate 1)', detail: '1x Tablet / Ruggedized Laptop with Google Chrome. 4G SIM or compound perimeter Wi-Fi connection.' },
  { item: 'Checkpoint 2 (Pedestrian Search Turnstile)', detail: '1x Laptop or PC Workstation. USB 2D Barcode/QR scanner gun (standard plug-and-play) for fast pass scanning.' },
  { item: 'Checkpoint 3 (Main Lobby Reception)', detail: '1x PC Workstation for Receptionist. Standard thermal badge printer (Zebra / Brother) if physical sticker badges are issued.' },
  { item: 'Checkpoint 4 (Vehicle Exit Gate 2)', detail: '1x Mobile phone or tablet for exit officer to scan passes and confirm visitor departure.' },
  { item: 'FSM & UNDSS Operations Room', detail: 'Central oversight workstation to monitor live compound headcount, approve high-volume delegations, and export logs.' }
];

checklist.forEach(c => {
  const y = doc.y;
  doc.rect(50, y, doc.page.width - 100, 24).fillAndStroke('#f8fafc', C_LINE);
  doc.rect(50, y, 3, 24).fill(C_UN_BLUE);
  doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C_NAVY).text(c.item, 60, y + 5);
  doc.fontSize(7.5).font('Helvetica').fillColor(C_SLATE).text(c.detail, 60, y + 14);
  doc.y = y + 28;
});

doc.moveDown(0.5);

// Sign-off Box
const signY = doc.y;
doc.rect(50, signY, doc.page.width - 100, 56).fillAndStroke('#f0f9ff', '#bae6fd');
doc.fontSize(9).font('Helvetica-Bold').fillColor(C_DARK_BLUE)
  .text('DEPLOYMENT READINESS SIGN-OFF', 62, signY + 10);
doc.fontSize(8).font('Helvetica').fillColor(C_NAVY)
  .text('Software Version: UNVMS Production Build 2026.3 · Target Hosting: https://unhouse-vms.web.app\nPrepared for: UN House Common Services, UNDSS Security Focal Points & UN ICT Working Group.\nAttribution: Engineered by SKILL.SCH · Inquiries & Technical Support: Desk Ext. 2010 / 2030', 62, signY + 24, { lineGap: 2 });

// Page Numbers & Footer on all pages
const pages = doc.bufferedPageRange();
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);
  doc.rect(50, doc.page.height - 35, doc.page.width - 100, 0.5).fill(C_LINE);
  doc.fontSize(7.5).fillColor(C_LIGHT_SLATE).font('Helvetica')
    .text('UN House Abuja · Visitor Management System (UNVMS) · Engineered by SKILL.SCH', 50, doc.page.height - 28, { align: 'left' });
  doc.text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 28, { align: 'right' });
}

doc.end();

stream.on('finish', () => {
  console.log('PDF generation complete:', outputPath);
});
