param(
  [string]$Target = "https://navixasa.com",
  [string]$ReportDir = ".\navixa-security-reports"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker is not available. Install/start Docker Desktop, then run this script again."
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null
$reportPath = (Resolve-Path $ReportDir).Path
$templateDir = Join-Path $reportPath "nuclei-templates"
New-Item -ItemType Directory -Force -Path $templateDir | Out-Null
$templatePath = (Resolve-Path $templateDir).Path

Write-Host "[1/5] Pulling OWASP ZAP 2.17.0..."
docker pull ghcr.io/zaproxy/zaproxy:2.17.0
if ($LASTEXITCODE -ne 0) { throw "Could not pull the ZAP image." }

Write-Host "[2/5] Running passive ZAP baseline against $Target..."
docker run --rm `
  --mount "type=bind,source=$reportPath,target=/zap/wrk" `
  ghcr.io/zaproxy/zaproxy:2.17.0 `
  zap-baseline.py `
  -t $Target `
  -m 2 `
  -I `
  -r navixa-zap.html `
  -J navixa-zap.json `
  -w navixa-zap.md
$zapExit = $LASTEXITCODE

Write-Host "[3/5] Pulling Nuclei 3.11.1..."
docker pull projectdiscovery/nuclei:v3.11.1
if ($LASTEXITCODE -ne 0) { throw "Could not pull the Nuclei image." }

Write-Host "[4/5] Fetching official Nuclei templates..."
docker run --rm `
  --mount "type=bind,source=$templatePath,target=/templates" `
  projectdiscovery/nuclei:v3.11.1 `
  -ut `
  -ud /templates
if ($LASTEXITCODE -ne 0) { throw "Could not fetch official Nuclei templates." }

Write-Host "[5/5] Running controlled High/Critical Nuclei validation..."
docker run --rm `
  --mount "type=bind,source=$reportPath,target=/out" `
  --mount "type=bind,source=$templatePath,target=/templates,readonly" `
  projectdiscovery/nuclei:v3.11.1 `
  -u $Target `
  -t /templates `
  -severity high,critical `
  -etags fuzz,dos,bruteforce,intrusive `
  -dut `
  -ni `
  -rl 5 `
  -c 5 `
  -bs 5 `
  -timeout 8 `
  -retries 1 `
  -jle /out/navixa-nuclei.jsonl `
  -se /out/navixa-nuclei.sarif `
  -duc
$nucleiExit = $LASTEXITCODE

$nucleiFindings = 0
$nucleiJsonl = Join-Path $reportPath "navixa-nuclei.jsonl"
if (Test-Path $nucleiJsonl) {
  $nucleiFindings = (Get-Content $nucleiJsonl | Measure-Object -Line).Lines
}

Write-Host ""
Write-Host "Reports: $reportPath"
Write-Host "ZAP process exit: $zapExit"
Write-Host "Nuclei process exit: $nucleiExit"
Write-Host "Nuclei High/Critical findings: $nucleiFindings"

if ($zapExit -ne 0 -or $nucleiExit -ne 0 -or $nucleiFindings -gt 0) {
  Write-Warning "Security validation needs review. Do not treat this as a confirmed exploit until the finding is manually verified."
  exit 2
}

Write-Host "Controlled validation completed without blocking findings." -ForegroundColor Green
