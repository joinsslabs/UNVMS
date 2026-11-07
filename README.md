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

## Roles

admin, approver, gate, docs, reception, vip, host. New accounts start as `pending` until an admin assigns a role.
The first account ever created becomes admin. All permissions are enforced in `firestore.rules`.
