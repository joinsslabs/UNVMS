# UN House Abuja Visitor Management System (UNVMS) — Project Memory & AI Rules

> **Note for AI Coding Assistants (Antigravity, Gemini, Claude, Cursor):**
> This file is the permanent memory of the UNVMS project. Read this file completely before making any changes.

---

## 1. Project Identity & Context
* **Project Name**: United Nations House Abuja Visitor Management System (UNVMS)
* **Location**: Plot 617/618 Diplomatic Drive, Central Business District, Abuja, Nigeria
* **Framework**: UN Business Operations Strategy (BOS 2.0) · UN Common Services & UNDSS Nigeria
* **Resident Agencies**: 20+ resident agencies (UNDSS, Common Services, WHO, UNDP, UNICEF, UNHCR, WFP, UNFPA, UN Women, ILO, FAO, UNODC, etc.)
* **GitHub Repository**: `https://github.com/raphgab/UNVMS.git` (branch: `main`)
* **Live Production Targets**:
  * Primary: `https://unhouse-vms.web.app`
  * Secondary: `https://unhouse-vms-abj26.web.app`
  * Firebase Project ID: `unhouse-vms-abj26`

---

## 2. Codebase Architecture & Source of Truth

| File | Purpose | Source or Output? |
| :--- | :--- | :--- |
| `un-house-access.html` | **PRIMARY SOURCE OF TRUTH**. Contains full app UI, styles, state, views, and Firebase integration. | **SOURCE** (Always edit this file) |
| `build.ps1` / `build.sh` | Build script that validates syntax via Node.js and writes `app.html`. | **BUILD TOOL** |
| `firebase-app/public/app.html` | Generated production application file. | **OUTPUT** (Never edit directly; recompile with `build.ps1`) |
| `firebase-app/public/index.html` | Public diplomatic landing page with parallax scroll and multiplane depth. | **SOURCE** |
| `firebase-app/public/login.html` | Passwordless Outlook Magic Link login portal for UN staff. | **SOURCE** |
| `firebase-app/firestore.rules` | Security rules with RBAC (`admin`, `sec_admin`, `sec_deputy`, `gate`, etc.). | **SOURCE** |
| `firebase-app/firebase.json` | Multi-site hosting configuration and Firestore settings. | **SOURCE** |

### Golden Build Rule:
```powershell
# Always run build.ps1 after making any changes to un-house-access.html:
powershell -ExecutionPolicy Bypass -File "build.ps1"
```

---

## 3. Four-Station Physical Compound Workflow
Compound security follows a strict 4-station physical progression:
1. **Station 1 — Gate Reception (`view=gate`)**: Perimeter verification. Verifies expected pre-approvals against the live UNDSS Watchlist. Cleared visitors proceed to Station 2. Once admitted, they are cleared from Station 1's expected list.
2. **Station 2 — Documentation & Tags (`view=tagging`)**: In-person Government photo ID inspection. Physical ID is retained securely in exchange for an authorized colour-coded lanyard tag (zero cloud ID scanning for privacy).
3. **Station 3 — Main Internal Reception (`view=reception`)**: Contact host officer via phone or desk intercom (`Notify Host` button), send arrival notification, complete check-in, and collect tags on compound departure.
4. **Station 4 — VIP Diplomatic Gate (`view=vip`)**: Ambassadors, Ministers, and Heads of Mission fast-tracked with protocol officer escort.

---

## 4. Key Design & Technical Rules

### 1. Button Styling & CSS Masks
* `.btn[data-act]::before` renders icons via CSS `-webkit-mask`.
* **NEVER** use inline `--ic: none` alone on `.btn[data-act]`. In CSS, `mask: none` unmasks `background: currentColor`, rendering an unwanted black square.
* Always use `.btn.no-ic` or the dedicated `.btn[data-act="notify"]` which renders the phone handset SVG icon in vibrant UN Blue (`#0284c7`) on light sky blue (`#f0f9ff` background, `#7dd3fc` border).

### 2. Automatic Host Agency Selection
* In both the **"Create Visitor Invitation Link"** modal (`openInviteDialog()`) and the **Host Invites View** (`inviteView()`), the host agency dropdown automatically selects the sending staff member's agency via `getStaffAgency(me)`.
* In **Demo Mode**, switching roles in the *View as* dropdown immediately updates `me.agency` (e.g. FSM / Gate / Docs $\rightarrow$ `UNDSS`, Reception / VIP / Admin $\rightarrow$ `Common Services`, WHO $\rightarrow$ `WHO`, etc.).
* If an operator enters another staff host from `hostStaffList`, the agency dropdown synchronizes dynamically with that host's agency.

### 3. Landing Page Parallax
* `firebase-app/public/index.html` features a hardware-accelerated parallax effect on the hero background glow orbs, diagonal accent, floating `20+ UN Resident Agencies` badge, and hero photo, with 3D cursor tilt on desktop.
* Always maintain `prefers-reduced-motion` compliance.

### 4. Firestore Security Roles
* `sec_admin` (Facilities Security Manager / FSM) and `sec_deputy` (Deputy Security Officer) share administrative clearance and staff management access alongside `admin`.

---

## 5. Deployment Commands
```powershell
# 1. Compile source into public/app.html
powershell -ExecutionPolicy Bypass -File "build.ps1"

# 2. Push commits to GitHub
git add -A
git commit -m "feat/fix: <description>"
git push origin main

# 3. Deploy to Firebase (Hosting & Rules)
cd firebase-app
firebase deploy --only hosting,firestore:rules
```
