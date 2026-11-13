# UN House Abuja Visitor Management System (UNVMS)
## Master Project State, Memory & Computer Migration Guide

```
========================================================================================
Project Name:         UN House Abuja Visitor Management System (UNVMS)
Location:             Plot 617/618 Diplomatic Drive, Central Business District, Abuja
Lead Operating Org:   UN Common Services & UNDSS
Lead Agencies:        UNDP & United Nations Secretariat (@undp.org, @un.org)
Engineering & IP:     Engineered by SKILL.SCH
Lead Engineer:        Raphael Gab-Momoh (raphgm)
Primary Remote:       https://github.com/joinsslabs/UNVMS.git
Secondary Remote:     https://github.com/raphgab/UNVMS.git
Primary Branch:       main
Live Production URLs: https://unhouse-vms.web.app
                      https://unhouse-vms-abj26.web.app
Firebase Project ID:  unhouse-vms-abj26
========================================================================================
```

---

## 1. Quick Setup on New Computer

When setting up on your new computer, follow these simple steps:

```bash
# 1. Clone the repository
git clone https://github.com/joinsslabs/UNVMS.git
cd UNVMS

# 2. Install dependencies (for PDF generation & tools)
npm install

# 3. Install Firebase CLI globally (if not already installed)
npm install -g firebase-tools

# 4. Authenticate Firebase
firebase login

# 5. Verify git status and branches
git status
```

---

## 2. Key Architecture & Repository Files

| Path | Purpose & Description |
| :--- | :--- |
| `firebase-app/public/app.html` | **Core Operations Console**: 4-Station security workflows, Staff Host dashboard, pass generator. |
| `firebase-app/public/login.html` | **Authentication Screen**: 1-field Magic Link form for `@undp.org` / `@un.org` Outlook delivery. |
| `firebase-app/public/index.html` | **Public Diplomatic Landing Portal**: Visitor guidelines, location, checkpoint information. |
| `firebase-app/firestore.rules` | **Server-side Security Rules**: Role-based access control, tenant isolation, immutable audit logs. |
| `firebase-app/public/UN_House_VMS_IT_Integration_Briefing.pdf` | **Executive Presentation PDF**: 3-page verified briefing for UNDSS & Common Services. |
| `generate_briefing_pdf.js` | PDFKit generator script for compiling the briefing PDF. |
| `run_code_scan.js` | Comprehensive static code security & OWASP audit script. |
| `README.md` | Comprehensive technical handover guide for UN IT staff. |
| `un-house-access.html` | Root mirror of the application console source. |

---

## 3. Operational State & Recent Accomplishments

### A. Authentication & Zero-Friction Staff Onboarding:
- **Zero New Emails**: UN staff use their existing `@undp.org` and `@un.org` work emails.
- **1-Click Magic Link**: Dispatches directly into Microsoft Outlook. No password needed.
- **Auto-Host Role**: When staff log in, they automatically receive `role: "host"` and land straight on the **Register & Invite** screen without needing administrative approval.
- **Host Sidebar**: Streamlined to 3 views: `Register & Invite`, `Dashboard` (only their own visitors), and `History`.
- **Microsoft SSO Button**: Safely deferred / commented out so no staff encounters tenant approval blockers before UN ICT activates consent.

### B. Executive Presentation PDF:
- Redesigned and verified as **strictly 3 pages** (`Page 1 of 3`, `Page 2 of 3`, `Page 3 of 3`).
- Zero blank pages, zero title collisions, zero broken emoji glyphs.
- Backed up to Desktop: `UN_House_VMS_IT_Integration_Briefing.pdf`.
- Deployed live: `https://unhouse-vms.web.app/UN_House_VMS_IT_Integration_Briefing.pdf`.

### C. Branding & Attributions:
- Mastheads across both sides of the login screen set to:
  `UNITED NATIONS VISITORS MANAGEMENT SYSTEM` (with smaller, refined typography).
- Attribution set strictly to: `Engineered by SKILL.SCH`.
- Removed "Guided Protocol Demo" from the footer under *Security & Guidelines*.

### D. GitHub Contributor Cleanup:
- Contributor list cleared of third-party bot/Claude references.
- All 172+ commits are authored and committed exclusively by `SKILL.SCH <rdgabmomoh@gmail.com>`.
- Remote origin points to `https://github.com/joinsslabs/UNVMS.git`.

---

## 4. Business & Negotiation Context (Mr. Andrew - House Manager)

- **Situation**: House Manager asked for the live link as a "demo".
- **Position**: What exists is **not a prototype**, but **100% complete, fully functional software** with active M365 integration.
- **Strategy & Agreed Response**:
  1. Explain that sending raw operational links ahead of an agreement bypasses standard procurement and governance.
  2. Offer to return in person to run a **guided live demonstration of the full workflow without sample data** and answer all his team's questions.
  3. Reassure him that under the formal agreement, **full GitHub repository rights, complete source code, and intellectual property ownership will be transferred directly to the UN**, complete with automated GitHub vulnerability test pipelines.
  4. Attach the 3-page Technical Briefing PDF.

---

## 5. Deployment Commands Quick Reference

```bash
# Deploy Frontend & Hosting to Live Firebase
cd firebase-app
firebase deploy --only hosting --project unhouse-vms-abj26

# Deploy Firestore Security Rules
firebase deploy --only firestore:rules --project unhouse-vms-abj26

# Recompile Presentation PDF
node generate_briefing_pdf.js

# Run Security Audit Scan
node run_code_scan.js
```
