#!/bin/sh
# Builds firebase-app/public/app.html from un-house-access.html.
cd "$(dirname "$0")"
{
printf '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
printf '<meta name="theme-color" content="#1e2f52"><link rel="manifest" href="manifest.json"><link rel="icon" href="icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="icon.svg">\n'
printf '<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>\n<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>\n<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>\n<script src="firebase-config.js"></script>\n'
printf '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>\n</head><body>\n'
cat un-house-access.html
printf '\n</body></html>\n'
} > firebase-app/public/app.html
sed -n '/^<script>$/,/^<\/script>$/p' firebase-app/public/app.html | sed '1d;$d' > "${TEMP:-/tmp}/c.js" && node --check "${TEMP:-/tmp}/c.js" 2>/dev/null || "/c/Program Files/nodejs/node.exe" --check "${TEMP:-/tmp}/c.js" && echo "Built and syntax-checked firebase-app/public/app.html"
