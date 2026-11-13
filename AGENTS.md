# Agent Guidelines for UN House Visitor Management System (UNVMS)

This repository contains the United Nations House Abuja Visitor Management System.

## Project Structure
- `un-house-access.html`: Primary source code for the single-page application.
- `firebase-app/public/`: Static web assets served by Firebase Hosting.
  - `app.html`: Generated from `un-house-access.html` via `build.ps1`.
  - `index.html`: Public landing page.
  - `login.html`: Staff authentication.
- `firebase-app/firestore.rules`: Security rules for Cloud Firestore.
- `build.ps1`: Primary build script. Rebuilds `firebase-app/public/app.html` from `un-house-access.html`.

## Critical Guidelines
1. **Source of Truth**: Always edit `un-house-access.html`, never edit `firebase-app/public/app.html` directly.
2. **Build Verification**: Run `powershell -ExecutionPolicy Bypass -File "build.ps1"` after modifying `un-house-access.html`.
3. **Agency Affiliation**: When generating visitor invitation links, the system must always pre-select the agency of the staff sending the invite.
4. **Button Icon CSS**: Keep `.btn[data-act]` styled with valid mask properties or suppress with `.btn.no-ic`. Do not introduce solid block artifacts next to button labels.
5. **Diplomatic UN Styling**: Maintain light, diplomatic palettes (`#0284c7`, `#f0f9ff`, `#092653`) adhering to UN Common Services Abuja visual identity.
