const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const doc = new PDFDocument({
  size: 'A4', // 595.28 x 841.89 pt
  margins: { top: 40, bottom: 40, left: 45, right: 45 },
  bufferPages: true,
  autoFirstPage: true,
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
const C_SLATE = '#334155';
const C_LIGHT_SLATE = '#64748b';
const C_BG_LIGHT = '#f8fafc';
const C_LINE = '#cbd5e1';
const C_GREEN = '#15803d';
const C_AMBER = '#b45309';

const contentWidth = doc.page.width - 90; // 505.28 pt

// Clean Header for Pages 2 and 3
function drawPageHeader(subTitleText) {
  doc.rect(45, 38, contentWidth, 2).fill(C_UN_BLUE);
  doc.fontSize(7.5).fillColor(C_LIGHT_SLATE).font('Helvetica-Bold')
    .text('UNITED NATIONS HOUSE ABUJA · COMMON SERVICES & UNDSS', 45, 24, { align: 'left' });
  doc.fontSize(7.5).fillColor(C_DARK_BLUE).font('Helvetica-Bold')
    .text(subTitleText, 45, 24, { align: 'right' });
  doc.y = 50;
}

function renderSectionTitle(num, title) {
  doc.moveDown(0.5);
  const y = doc.y;
  doc.rect(45, y, 3.5, 14).fill(C_UN_BLUE);
  doc.fontSize(10.5).fillColor(C_DARK_BLUE).font('Helvetica-Bold')
    .text(`${num}. ${title.toUpperCase()}`, 55, y + 1.5);
  doc.y = y + 18;
}

function renderSubTitle(title) {
  doc.moveDown(0.2);
  doc.fontSize(9).fillColor(C_NAVY).font('Helvetica-Bold').text(title);
  doc.moveDown(0.15);
}

function renderBody(text) {
  doc.fontSize(8).fillColor(C_SLATE).font('Helvetica').text(text, { lineGap: 1.8 });
  doc.moveDown(0.25);
}

// =========================================================================
// PAGE 1: EXECUTIVE OVERVIEW & 4-STATION ACCESS PIPELINE
// =========================================================================

// Diplomatic Top Banner
doc.rect(0, 0, doc.page.width, 135).fill('#0f1a30');
doc.rect(0, 132, doc.page.width, 3).fill(C_UN_BLUE);

doc.fillColor('#94a3b8').fontSize(9).font('Helvetica-Bold')
  .text('UNITED NATIONS COMMON SERVICES · NIGERIA', 45, 26, { characterSpacing: 0.8 });

doc.fillColor('#ffffff').fontSize(17).font('Helvetica-Bold')
  .text('UN House Visitor Management System (UNVMS)', 45, 42);

doc.fillColor('#93c5fd').fontSize(9.5).font('Helvetica')
  .text('Technical Architecture, IT Integration Scope & Compound Deployment Guide', 45, 68);

// Two Clean Badges (Using Solid UN Colors, Zero Broken Emojis)
const badgeY = 92;
// Left Badge
doc.rect(45, badgeY, 210, 24).fillAndStroke('#1e293b', '#0284c7');
doc.rect(45, badgeY, 4, 24).fill('#0284c7');
doc.fontSize(8).fillColor('#38bdf8').font('Helvetica-Bold')
  .text('SECURITY FRAMEWORK', 55, badgeY + 4);
doc.fontSize(7.5).fillColor('#ffffff').font('Helvetica')
  .text('UNDSS Security Level 2 · UN BOS 2.0 Directives', 55, badgeY + 13);

// Right Badge
doc.rect(265, badgeY, 210, 24).fillAndStroke('#1e293b', '#0284c7');
doc.rect(265, badgeY, 4, 24).fill('#0284c7');
doc.fontSize(8).fillColor('#38bdf8').font('Helvetica-Bold')
  .text('ENGINEERING ATTRIBUTION', 275, badgeY + 4);
doc.fontSize(7.5).fillColor('#ffffff').font('Helvetica')
  .text('Production Build · Engineered by SKILL.SCH', 275, badgeY + 13);

doc.y = 150;

// Section 1: Executive Summary
renderSectionTitle('1', 'Executive Summary');
renderBody('The UN House Abuja Visitor Management System (UNVMS) is an integrated digital platform engineered to modernize, secure, and streamline compound physical access under the UN Business Operations Strategy (BOS 2.0) and UNDSS physical security directives.');
renderBody('UN House Abuja accommodates 20+ resident UN agencies at Plot 617/618 Diplomatic Drive. UNDP and the UN Secretariat (@undp.org and @un.org) lead compound operations and Common Services. This briefing outlines the exact technical mechanisms in place, confirms what is 100% operational out of the box, and defines the exact, minimal footprint where UN ICT intervention is optional or beneficial.');

// Key Strategic Callout
const callY = doc.y;
doc.rect(45, callY, contentWidth, 38).fillAndStroke('#f0fdf4', '#86efac');
doc.rect(45, callY, 4, 38).fill(C_GREEN);
doc.fontSize(8.5).fillColor(C_GREEN).font('Helvetica-Bold')
  .text('STRATEGIC TAKEAWAY FOR ICT & EXECUTIVE MANAGEMENT', 57, callY + 6);
doc.fontSize(7.5).fillColor(C_NAVY).font('Helvetica')
  .text('UNVMS is fully operational today with zero new email accounts, zero complex database requirements, and zero administrative roadblocks. Staff use their existing official UN email inboxes, visitors require no accounts, and checkpoint officers authenticate securely.', 57, callY + 18, { width: contentWidth - 20, lineGap: 1.5 });
doc.y = callY + 44;

// Section 2: 4-Station Access Pipeline
renderSectionTitle('2', '4-Station Compound Access Pipeline');
renderBody('The system enforces a strict 4-station physical and visual verification pipeline to guarantee compound integrity:');

const stations = [
  { s: 'Station 1 · Gate Clearance (Perimeter Entry)', d: 'Vehicle and preliminary pedestrian credential verification. Rapid lookup against pre-approved guest invitations and security watchlists before perimeter barrier access.' },
  { s: 'Station 2 · Documentation & Tagging (Pedestrian Search Turnstile)', d: 'Government photo ID verification, physical baggage screening, visual photo capture, and physical visitor badge assignment.' },
  { s: 'Station 3 · Main Reception Check-In (Diplomatic Lobby)', d: 'Final reception clearance, automated arrival alert dispatch to host agency staff via Outlook inbox and WhatsApp, and badge activation.' },
  { s: 'Station 4 · Exit Checkout (Vehicle Gate 2 & Turnstile)', d: 'Compound departure timestamping, visual badge surrender, and live evacuation muster roll updating.' },
  { s: 'VIP Diplomatic Gate & Protocol Fast-Track', d: 'Expedited diplomatic clearance workflow for Ambassadors, High Commissioners, Heads of Agency, and Federal Ministers.' }
];

stations.forEach(st => {
  const y = doc.y;
  doc.circle(52, y + 4.5, 2.5).fill(C_UN_BLUE);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(C_NAVY).text(st.s, 60, y);
  doc.fontSize(7.5).font('Helvetica').fillColor(C_SLATE).text(st.d, 60, y + 10, { width: contentWidth - 20, lineGap: 1.2 });
  doc.y = y + 25;
});

// =========================================================================
// PAGE 2: AUTHENTICATION ARCHITECTURE & IT INTEGRATION MATRIX
// =========================================================================
doc.addPage();
drawPageHeader('IT FOOTPRINT & AUTHENTICATION ARCHITECTURE');

renderSectionTitle('3', 'Authentication Model: Zero New Email Accounts');
renderBody('A central operational mandate is that NO staff member, security officer, or guest is ever required to create or maintain a secondary email address.');

renderSubTitle('A. Official UN Staff & Host Officers (Passwordless Magic Link)');
renderBody('• Staff enter their existing official work email (e.g. name@undp.org or name@un.org).\n• A secure, single-use, 15-minute cryptographic sign-in link is dispatched directly into their Microsoft Outlook / M365 inbox.\n• Clicking the link in Outlook automatically authenticates them into their operations console.\n• Staff names and agency affiliations are automatically detected from their email and matched against the pre-loaded UN Staff Directory.');

renderSubTitle('B. Station & Gate Security Officers');
renderBody('• Dedicated credentials for Station 1 (Gate), Station 2 (Search/ID), Station 3 (Reception), Station 4 (Exit), VIP Protocol, and UNDSS Field Security Supervisors (FSM).\n• Role-based access ensures officers only see tools relevant to their specific checkpoint.');

renderSubTitle('C. External Visitors & Guests');
renderBody('• 100% tokenized web links (via SMS, WhatsApp, or invitation email). Visitors never register, download apps, or remember passwords. They simply fill in arrival details and receive a digital QR pass.');

renderSectionTitle('4', 'Comprehensive IT Integration & Intervention Matrix');
renderBody('The table below summarizes every technical subsystem and details the exact level of UN ICT involvement:');

// Draw Table
const tableY = doc.y + 2;
const colW = [115, 95, 95, 200];
const headers = ['System Component', 'Operational Status', 'IT Required?', 'Details / Action Required'];

// Table Header
doc.rect(45, tableY, contentWidth, 18).fill('#0f172a');
let curX = 50;
headers.forEach((h, i) => {
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#ffffff').text(h, curX, tableY + 5, { width: colW[i] - 10 });
  curX += colW[i];
});

let rowY = tableY + 18;
const rows = [
  ['Staff Sign-In (Magic Link)', 'Live & Verified', 'None (0%)', 'Dispatches directly to @undp.org or @un.org Outlook inboxes out of the box.'],
  ['Station 1-4 Operations', 'Live & Verified', 'None (0%)', 'Standalone web consoles operate on standard browsers (Chrome, Edge, Safari).'],
  ['Visitor Digital Passes', 'Live & Verified', 'None (0%)', 'Tokenized links with dynamic QR generation. No app store installation.'],
  ['QR / Camera Scanning', 'Live & Verified', 'None (0%)', 'Standard HTML5 browser cameras; standard USB 2D scanners act as keyboards.'],
  ['Host WhatsApp Alerts', 'Live & Verified', 'None (0%)', 'Uses 1-click wa.me direct dispatch without external server dependency.'],
  ['Email Spam Allowlisting', 'Recommended', 'Minor (5 min)', 'UN ICT mail admin adds sender domain to M365 Safe Senders to prevent Junk folder.'],
  ['Station Hardware & Wi-Fi', 'Deployment Task', 'Facilities/IT', 'Ensure security checkpoint tablets/laptops have compound Wi-Fi or 4G SIM.'],
  ['Custom Compound Domain', 'Optional', 'Minor (10 min)', 'DNS CNAME pointing (e.g. unhouseabuja.org / access.un.org) if requested.'],
  ['Microsoft Entra ID (SSO)', 'Ready / Deferred', 'Optional', 'Popup SSO button preserved in code; ready for 1-click activation when tenant consents.']
];

rows.forEach((r, idx) => {
  const bg = idx % 2 === 0 ? '#f8fafc' : '#ffffff';
  doc.rect(45, rowY, contentWidth, 20).fillAndStroke(bg, C_LINE);
  curX = 50;
  r.forEach((val, i) => {
    const isBold = i === 0;
    const isAlert = i === 2 && val.includes('None');
    doc.fontSize(7).font(isBold ? 'Helvetica-Bold' : 'Helvetica')
      .fillColor(isAlert ? C_GREEN : (i === 2 && val.includes('Minor') ? C_AMBER : C_NAVY))
      .text(val, curX, rowY + 5, { width: colW[i] - 10, lineGap: 1 });
    curX += colW[i];
  });
  rowY += 20;
});

doc.y = rowY + 10;

// =========================================================================
// PAGE 3: SECURITY, COMPLIANCE & PHYSICAL CHECKPOINT ROLLOUT
// =========================================================================
doc.addPage();
drawPageHeader('SECURITY, COMPLIANCE & PHYSICAL DEPLOYMENT');

renderSectionTitle('5', 'Security, Data Protection & BOS 2.0 Compliance');
renderBody('UNVMS is architected under strict adherence to the United Nations Principles on Personal Data Protection and Privacy:');

const points = [
  'Purpose Limitation: Visitor data (full name, phone, agency visited, badge number) is retained strictly for physical security, contact tracing, and emergency evacuation accountability.',
  'Data Minimization: No unnecessary sensitive personal information is requested or permanently stored.',
  'Encrypted in Transit & at Rest: All communication is encrypted via TLS 1.3 HTTPS; database entries and session credentials are encrypted in Google Firebase Cloud infrastructure.',
  'Accountability & Audit Trails: Every pass generation, station clearance, and watchlist check logs timestamped supervisor identifiers.',
  'Real-Time Evacuation Muster: In the event of compound alarm or drill, UNDSS supervisors can instantly generate the live count and identity of all visitors currently inside UN House.'
];

points.forEach(p => {
  const y = doc.y;
  doc.circle(52, y + 4.5, 2.5).fill(C_DARK_BLUE);
  const [b, ...rest] = p.split(':');
  doc.fontSize(8).font('Helvetica-Bold').fillColor(C_NAVY).text(b + ':', 60, y, { continued: true });
  doc.font('Helvetica').fillColor(C_SLATE).text(rest.join(':'), { lineGap: 1.2 });
  doc.y = y + 21;
});

renderSectionTitle('6', 'Physical Checkpoint Deployment Checklist');
renderBody('To roll out the system across UN House Abuja gates, the operational team should complete these practical steps:');

const checklist = [
  { item: 'Checkpoint 1 (Vehicle Gate 1)', detail: '1x Tablet / Ruggedized Laptop with Google Chrome. 4G SIM or compound perimeter Wi-Fi connection.' },
  { item: 'Checkpoint 2 (Pedestrian Search Turnstile)', detail: '1x Laptop or PC Workstation. USB 2D Barcode/QR scanner gun (standard plug-and-play) for fast pass scanning.' },
  { item: 'Checkpoint 3 (Main Lobby Reception)', detail: '1x PC Workstation for Receptionist. Standard thermal badge printer (Zebra / Brother) if physical sticker badges are issued.' },
  { item: 'Checkpoint 4 (Vehicle Exit Gate 2)', detail: '1x Mobile phone or tablet for exit officer to scan passes and confirm visitor departure.' },
  { item: 'FSM & UNDSS Operations Room', detail: 'Central oversight workstation to monitor live compound headcount, approve high-volume delegations, and export logs.' }
];

checklist.forEach(c => {
  const y = doc.y;
  doc.rect(45, y, contentWidth, 22).fillAndStroke('#f8fafc', C_LINE);
  doc.rect(45, y, 3, 22).fill(C_UN_BLUE);
  doc.fontSize(8).font('Helvetica-Bold').fillColor(C_NAVY).text(c.item, 54, y + 4);
  doc.fontSize(7).font('Helvetica').fillColor(C_SLATE).text(c.detail, 54, y + 12);
  doc.y = y + 25;
});

doc.moveDown(0.4);

// Sign-off Box
const signY = doc.y;
doc.rect(45, signY, contentWidth, 54).fillAndStroke('#f0f9ff', '#bae6fd');
doc.fontSize(8.5).font('Helvetica-Bold').fillColor(C_DARK_BLUE)
  .text('DEPLOYMENT READINESS SIGN-OFF', 57, signY + 8);
doc.fontSize(7.5).font('Helvetica').fillColor(C_NAVY)
  .text('Software Version: UNVMS Production Build 2026.3 · Target Hosting: https://unhouse-vms.web.app\nPrepared for: UN House Common Services, UNDSS Security Focal Points & UN ICT Working Group.\nAttribution: Engineered by SKILL.SCH · Inquiries & Technical Support: Desk Ext. 2010 / 2030', 57, signY + 20, { lineGap: 2 });

// =========================================================================
// PRECISE 3-PAGE NUMBERING & FOOTERS (Zero Margin Overflow)
// =========================================================================
const pages = doc.bufferedPageRange();
for (let i = 0; i < pages.count; i++) {
  doc.switchToPage(i);
  doc.page.margins.bottom = 0;
  doc.rect(45, doc.page.height - 30, contentWidth, 0.5).fill(C_LINE);
  doc.fontSize(7).fillColor(C_LIGHT_SLATE).font('Helvetica')
    .text('UN House Abuja · Visitor Management System (UNVMS) · Engineered by SKILL.SCH', 45, doc.page.height - 24, { width: contentWidth / 2, lineBreak: false });
  doc.text(`Page ${i + 1} of ${pages.count}`, 45 + contentWidth / 2, doc.page.height - 24, { width: contentWidth / 2, align: 'right', lineBreak: false });
}

doc.end();

stream.on('finish', () => {
  console.log(`PDF generation complete. Total pages: ${pages.count}`);
});
