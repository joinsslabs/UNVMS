# United Nations House Abuja — Visitor Management System (UNVMS)
### Technical Handover & IT Operations Manual

```
========================================================================================
Project:       UN House Abuja Visitor Management System (UNVMS)
Location:      Plot 617/618 Diplomatic Drive, Central Business District, Abuja, Nigeria
Framework:     UN Business Operations Strategy (BOS 2.0) · Common Services & UNDSS
Lead Agencies: UNDP & United Nations Secretariat (@undp.org, @un.org)
Live Targets:  https://unhouse-vms.web.app · https://unhouse-vms-abj26.web.app
Engineering:   Engineered by SKILL.SCH
========================================================================================
```

---

## 1. System Overview

The **UN House Visitor Management System (UNVMS)** is a high-availability, zero-maintenance digital access control and emergency accountability platform designed specifically for the United Nations diplomatic compound in Abuja, Nigeria.

It serves **20+ UN resident agencies** (including UNDP, WHO, UNICEF, WFP, UNAIDS, UNODC, UNESCO, UNHCR, UNFPA, ILO, FAO, and UN Women) operating under **UNDSS Security Level 2**.

### Core Design Principles:
1. **Zero New Accounts Required**: UN staff use their existing `@undp.org` and `@un.org` work emails via passwordless single-use Magic Links. External visitors use tokenized web links and never create an account.
2. **Strict Role-Based Least Privilege**: UN staff only see their own invited guests; security checkpoints only see their assigned operational station; only UNDSS supervisors see compound-wide security queues and watchlists.
3. **BOS 2.0 Common Services Alignment**: Shared digital infrastructure that eliminates paper logbooks, reduces security wait times at Gate 1, and centralizes compound emergency muster accountability.

---

## 2. Staff Roles & The User Experience

### When a Normal UN Staff Member Logs In:
When an agency officer (e.g. `amina.bello@undp.org` or `john.doe@un.org`) enters their work email on the login screen:
1. They receive a 1-click Magic Link in their **Microsoft Outlook inbox**.
2. Upon clicking the link, the system **automatically recognizes them as a UN Staff Host** (`role: "host"`).
3. **They are NOT blocked by any "Awaiting Role" screen** and need no administrative approval to start inviting guests.

#### What a Normal UN Staff Member Sees:
- **Top Header Bar**: Shows their name, agency tag (e.g., `UNDP` or `UN`), and assigned role:
  `Dr. Amina Bello · UN Staff Host / Agency Officer (UNDP)`
- **Immediate Landing Screen**: The system opens directly into **Register & Invite** so they can create a visitor pass with zero clicks.

#### What Appears on the Host's Sidebar:
A normal UN staff member's sidebar is deliberately streamlined to **only 3 views**:

| Sidebar View | Purpose |
| :--- | :--- |
| **➕ Register & Invite** (`register`) | Create an immediate pre-clearance request, schedule a guest, or copy an instant self-registration invite link to send via WhatsApp or email. |
| **📊 Dashboard** (`dashboard`) | Shows **ONLY their own guests**. Displays real-time status: *Expected*, *Arrived at Gate 1*, *Screened at Station 2*, *Checked In at Station 3*. They can notify reception or extend their guest's stay. |
| **📜 History & Audit** (`history`) | Filterable log of their own past visitors and visit history. |

#### What is Hidden from Normal Staff (Security Isolation):
- Normal staff **CANNOT see**: Station 1 (Gate), Station 2 (Documentation & Search), Station 3 (Reception), or Station 4 (VIP Gate).
- Normal staff **CANNOT see**: Other agencies' confidential visitors, UNDSS Clearance Queues, Security Watchlists, Evacuation Muster Rolls, Server Settings, or Staff Administration.

---

### Complete Roles & Views Reference

| Role Key | Display Name | Assigned Users | Accessible Sidebar Views |
| :--- | :--- | :--- | :--- |
| `host` | **UN Staff Host / Agency Officer** | Any `@undp.org`, `@un.org`, or resident agency staff | `Register & Invite`, `Dashboard` (own guests), `History` |
| `gate` | **Station 1 · Gate Reception** | Perimeter gate security officers | `Station 1 · Gate`, `Contractors`, `Register`, `Watchlist`, `History` |
| `docs` | **Station 2 · Documentation & ID** | Pedestrian screening & search officers | `Station 2 · Documentation`, `Contractors`, `Register`, `History` |
| `reception` | **Station 3 · Main Reception** | Lobby receptionists & protocol clerks | `Station 3 · Reception`, `Kiosk`, `Register`, `History` |
| `vip` | **Station 4 · VIP Diplomatic Gate** | Diplomatic protocol officers | `Station 4 · VIP Gate`, `Register`, `History` |
| `sec_admin` | **Facilities Security Manager (FSM)** | UNDSS Field Security Officers | *Full Access* + Priority UNDSS Clearance queue, Muster Roll, Watchlist |
| `admin` | **System Administrator** | UN ICT & Common Services Admins | *Full Access* including System Settings & User Role Promotion |

---

## 3. Technology Stack & Repository Layout

```text
UNVMS/
├── firebase-app/
│   ├── public/
│   │   ├── index.html        # Public diplomatic landing portal
│   │   ├── login.html        # Authentication portal (Magic Link + Password)
│   │   ├── app.html          # Staff & Security Operations Console
│   │   ├── firebase-config.js# Firebase client credentials & settings
│   │   ├── un-emblem.svg     # Official vector United Nations emblem
│   │   └── UN_House_VMS_IT_Integration_Briefing.pdf # Official Briefing Document
│   ├── firestore.rules       # Server-side security rules (role enforcement)
│   ├── functions/            # Cloud Functions (audit trail, emailer, reports)
│   └── firebase.json         # Hosting & rewrites configuration
├── un-house-access.html      # Monolithic application source template
├── generate_briefing_pdf.js  # Script to compile executive PDF briefings
└── README.md                 # This Handover Document
```

### Architecture Highlights:
- **Zero Framework Bloat**: Built using pure vanilla JavaScript (ES6+), modern CSS custom properties, and standard web components. No heavy Node runtime or React/Angular compilation needed for the frontend.
- **Client Library**: Firebase Web SDK v10.12.2 (`compat` build).
- **Backend Infrastructure**: Google Cloud Platform (GCP) / Firebase:
  - **Hosting**: Global edge-cached CDN with automatic HTTP/2 and SSL.
  - **Database**: Cloud Firestore in `europe-west1` (Frankfurt, GDPR-compliant).
  - **Auth**: Passwordless email link delivery + Station credentials.

---

## 4. Day-1 IT Handover Action Checklist

When UN ICT assumes ownership of the application, complete the following straightforward steps:

### Step 1: Transfer Firebase Project Ownership *(10 minutes)*
1. The current project owner invites the UN ICT Lead Google/Gmail account at [console.firebase.google.com](https://console.firebase.google.com).
2. Go to **Project Settings** &rarr; **Users and permissions** &rarr; **Add member**.
3. Grant **Owner** role to the official UN ICT administrative account.

### Step 2: Configure Custom Domain *(5 minutes)*
The system currently runs on `https://unhouse-vms.web.app`. To attach `unhouseabuja.org` or an official subdomain like `access.un.org` / `access.undp.org`:
1. In Firebase Console, go to **Hosting** &rarr; Click **Add custom domain**.
2. Enter `unhouseabuja.org` (or `vms.unhouseabuja.org`).
3. Add the two **A Records** (IP addresses) and the **TXT verification record** in your domain registrar's DNS settings.
4. Firebase automatically provisions and manages an enterprise SSL certificate within 30 minutes.

### Step 3: Microsoft 365 Defender Email Allowlist *(5 minutes)*
Because Magic Links are sent to official `@undp.org` and `@un.org` inboxes:
1. Log into the **Microsoft Defender for Office 365** / Exchange Admin Center ([admin.exchange.microsoft.com](https://admin.exchange.microsoft.com)).
2. Navigate to **Mail flow** &rarr; **Rules** (or **Anti-Spam Policies**).
3. Add the sender domain:
   - `noreply@unhouse-vms-abj26.firebaseapp.com` (and your custom domain if configured).
4. Mark as **Bypass Spam Filtering** so authentication links never route into staff Junk or Quarantine folders.

### Step 4: Hardware Check at Gates *(Facilities & Security)*
Ensure the following minimal equipment is in place:
- **Station 1 (Gate 1)**: 1x tablet or laptop connected to compound perimeter Wi-Fi or 4G backup SIM.
- **Station 2 (Pedestrian Search)**: 1x PC with standard USB plug-and-play 2D QR barcode scanner gun.
- **Station 3 (Main Lobby)**: 1x PC with standard browser printing (thermal sticker badge printer optional).
- **Station 4 (Exit Gate 2)**: 1x mobile phone or tablet to scan departing visitor badges.

---

## 5. Deployment & Build Instructions

### Prerequisites
- Node.js (v18 or v20 LTS recommended).
- Firebase CLI:
  ```bash
  npm install -g firebase-tools
  ```

### Authenticating & Deploying
From the root repository directory:

```bash
# Log in with your authorized Firebase account
firebase login

# Navigate to the deployment folder
cd firebase-app

# Deploy Hosting (Front-end HTML/CSS/JS)
firebase deploy --only hosting --project unhouse-vms-abj26

# Deploy Firestore Security Rules
firebase deploy --only firestore:rules --project unhouse-vms-abj26
```

### Synchronizing Source Files
The application maintains two identical runtime files for flexibility:
- `un-house-access.html` (root source template)
- `firebase-app/public/app.html` (live hosted file)

When making frontend edits in `firebase-app/public/app.html`, always copy to root:
```powershell
Copy-Item firebase-app\public\app.html un-house-access.html -Force
```

---

## 6. How to Re-Enable Microsoft 365 Entra ID Single Sign-On (Optional)

If UN ICT later decides to activate direct Microsoft 365 OAuth popup sign-in across the UN tenant:

1. **In Microsoft Entra ID** ([entra.microsoft.com](https://entra.microsoft.com)):
   - Register an application named **"UN House Abuja VMS"**.
   - Supported account types: *Accounts in any organizational directory (Multitenant)*.
   - Redirect URI: `https://unhouse-vms-abj26.firebaseapp.com/__/auth/handler`.
   - Copy the **Application (client) ID** and generate a **Client Secret**.
   - Under **API Permissions**, grant admin consent for `User.Read` and `offline_access`.

2. **In Firebase Console**:
   - Go to **Authentication** &rarr; **Sign-in method** &rarr; **Add Provider** &rarr; **Microsoft**.
   - Paste the Application ID and Secret.

3. **In the Code**:
   - In `login.html` and `app.html`, simply uncomment the `#ms_go` button. The JavaScript handler (`firebase.auth.OAuthProvider('microsoft.com')`) is already fully written, tested, and waiting in place.

---

## 7. Emergency Muster Roll & Disaster Recovery

In the event of an emergency evacuation or compound drill:
1. UNDSS FSM supervisors navigate to **Muster Roll** (`muster`).
2. The view displays a live, real-time count of every external visitor, contractor, and VIP currently recorded inside the compound perimeter.
3. Supervisors can click **"🖨️ Print / Export Muster List"** or **"Download CSV"** even if the internet drops, as local session state retains the active headcount.

---

## 8. Technical Support & Contacts

- **UN House Common Services Desk**: Ext. 2010
- **UNDSS Control Desk / Security Operations**: Ext. 2030
- **Platform Development & Attribution**: Engineered by **SKILL.SCH**
- **Repository**: [https://github.com/raphgab/UNVMS](https://github.com/raphgab/UNVMS)
