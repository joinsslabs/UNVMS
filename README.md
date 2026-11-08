# UN House Access Control

Access and visitor management system for UN Common Services, United Nations House, Abuja.
Pilot built by SKILL.SCH.

- Live: https://unhouse-vms-abj26.web.app (landing) and https://unhouse-vms-abj26.web.app/app.html (staff app)
- Firebase project: `unhouse-vms-abj26` (Hosting, Firestore in europe-west1, Authentication)

## Layout

| Path | What it is |
| --- | --- |
| `un-house-access.html` | Source of the staff app (all screens and logic) |
| `firebase-app/public/app.html` | Built staff app: the source wrapped with the Firebase scripts |
| `firebase-app/public/index.html` | Landing page |
| `firebase-app/public/firebase-config.js` | Firebase web settings (public by design) and the Microsoft sign-in switch |
| `firebase-app/firestore.rules` | Server-side access rules: roles, approvals, append-only log, passes, invites |
| `firebase-app/functions/` | Server functions: audit trail, emails, daily report, retention, AI assistant, handwriting reader, booking API |

## Build and deploy

From `firebase-app` (Windows PowerShell):

```
firebase.cmd deploy --only "hosting,firestore" --project unhouse-vms-abj26
```

`public/app.html` is generated from `un-house-access.html` by wrapping it in a document head that loads the
Firebase app, auth and Firestore compat scripts (10.12.2) and `firebase-config.js`. Rebuild it after editing the source.

Server functions need the Blaze plan and these secrets (set with `firebase.cmd functions:secrets:set NAME`):
`SMTP_USER`, `SMTP_PASS` (email), `GEMINI_API_KEY` (AI features), `BOOKING_API_KEY` (booking API).

```
firebase.cmd deploy --only functions --project unhouse-vms-abj26
```

## Roles and Operational Stations

- **Station 1 (Gate Reception & Approvals):** Initial perimeter compound entry, physical tag rack inventory management, unscheduled visitor host phone verification, and admission to Station 2.
- **Station 2 (Documentation & ID Exchange):** Verification of Government photo IDs, equipment logging, physical lanyard tag issuance upon arrival, and check-out (retrieval of tag & return of deposited physical ID) upon compound exit.
- **Station 3 (Internal Reception):** Main Building lobby reception, desk phone host intercom notifications (`Ext. XXX`), and visitor host receipt/check-in.
- **Station 4 (VIP Gate):** Tablet-based diplomatic protocol and VIP reception for accredited Heads of Mission and diplomatic motorcades.
- **Administration & Security:** Role quotas (maximum 3 Administrators, 3 Security Administrators), watchlist governance, immutable audit log oversight.

## Hosting, Data Location & Nigeria NDPA 2023 Compliance Architecture

Official data residency, sovereignty, and legal compliance architecture briefing for United Nations ICT, UNDSS Security, and Host Country Legal Officers.

### 1. Cloud Infrastructure & Location
- **Provider:** Google Cloud Platform (GCP) / Firebase.
- **Data Center Region:** `europe-west1` (St. Ghislain, Belgium, European Union).
- **Sovereignty & Standards:** Tier-1 hyperscale infrastructure certified under ISO/IEC 27001, SOC 1/2/3, and GDPR adequacy.
- **Enterprise UN Tenant Transfer:** Readily transferable into corporate UN ICT Google Cloud or Microsoft Azure tenants upon institutional handover.

### 2. Data Minimization & Physical ID Custody
- **Zero Digital Scans Stored:** Physical Government IDs and Driver's Licenses are verified and kept in safe physical custody at Station 2; **no photocopies, biometric scans, or ID images are uploaded or stored in the database**.
- **Essential Operational Fields Only:** Visitor Name, Organisation, Phone, Host Name, Host Agency, Meeting Room, and physical Tag Number.
- **Zero Financial/NIN Data:** No National Identity Numbers (NIN), biometric templates, or financial records are processed.

### 3. Nigeria Data Protection Act (NDPA 2023) & UN Legal Framework
- **NDPA 2023 Alignment:** Complies with §§ 24, 25, 39, and 41–43 (cross-border data transfers to recognized jurisdictions with adequate data protection frameworks).
- **UN Legal Immunity & HLCM Principles:** Governed by the 1946 Convention on the Privileges and Immunities of the United Nations and the UN High-Level Committee on Management (HLCM) Principles on Personal Data Protection and Privacy.
- **Informed Consent:** Registered visitors explicitly accept the digital Visitor Rules and Privacy Notice.

### 4. Technical Security & Audit Integrity
- **Encryption:** TLS 1.3 encryption in transit (HTTPS/HSTS); AES-256 default encryption at rest.
- **Immutable Audit Trail:** Append-only server audit log (`/audit`) written via Cloud Functions with zero browser edits or deletions.
- **Single Sign-On (SSO):** Pre-configured for Microsoft Entra ID (Azure AD) corporate Single Sign-On for UN personnel (`@un.org`).
