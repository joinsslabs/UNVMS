# Builds firebase-app/public/app.html from un-house-access.html and syntax-checks the JS.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$head = @"
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#1e2f52"><link rel="manifest" href="manifest.json"><link rel="icon" href="icon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="icon.svg">
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js"></script>
<script src="firebase-config.js"></script>
<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}[hidden]{display:none!important}</style>
</head><body>
"@

$src = [System.IO.File]::ReadAllText((Join-Path $PSScriptRoot "un-house-access.html"))
$out = $head.Replace("`r`n", "`n") + "`n" + $src.Replace("`r`n", "`n") + "`n</body></html>`n"
$appPath = Join-Path $PSScriptRoot "firebase-app\public\app.html"
[System.IO.File]::WriteAllText($appPath, $out, (New-Object System.Text.UTF8Encoding($false)))

if ($out -match '(?s)\n<script>\n(.*?)\n</script>\n') {
  $tmpJs = Join-Path ([System.IO.Path]::GetTempPath()) "unvms-check.js"
  [System.IO.File]::WriteAllText($tmpJs, $Matches[1], (New-Object System.Text.UTF8Encoding($false)))
  node --check $tmpJs
  Remove-Item $tmpJs -ErrorAction SilentlyContinue
  Write-Host "Built and syntax-checked firebase-app/public/app.html"
} else {
  throw "Could not locate <script> block in firebase-app/public/app.html"
}
