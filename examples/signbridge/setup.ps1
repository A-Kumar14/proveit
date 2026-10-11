$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot
$repoRoot = (Resolve-Path (Join-Path $scriptDir "..\..")).Path
$venv = Join-Path $repoRoot ".venv-signbridge"

try {
    & py -3.12 --version | Out-Null
} catch {
    throw "Python 3.12 is required. Install Python 3.12 from python.org with the Python Launcher, then rerun this script."
}
if ($LASTEXITCODE -ne 0) {
    throw "Python 3.12 is required. Install Python 3.12 from python.org with the Python Launcher, then rerun this script."
}

$python = Join-Path $venv "Scripts\python.exe"
if (Test-Path $python) {
    & $python -c "import sys; raise SystemExit(sys.version_info[:2] != (3, 12))"
    if ($LASTEXITCODE -ne 0) {
        throw "$venv already exists but is not a Python 3.12 environment; remove it and rerun this script."
    }
} else {
    & py -3.12 -m venv $venv
    if ($LASTEXITCODE -ne 0) { throw "Could not create the SignBridge Python environment." }
}

& $python -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { throw "Could not update pip in the SignBridge environment." }

& $python -m pip install -r (Join-Path $scriptDir "requirements.txt")
if ($LASTEXITCODE -ne 0) { throw "Could not install the SignBridge dependencies." }

& $python (Join-Path $scriptDir "download_landmark_model.py")
if ($LASTEXITCODE -ne 0) { throw "Could not download the verified SignBridge models." }

Write-Host ""
Write-Host "SignBridge setup is complete."
Write-Host "Check the model installation with:"
Write-Host "  & `"$python`" `"$scriptDir\check_environment.py`""
Write-Host "Start the model service with:"
Write-Host "  & `"$python`" `"$scriptDir\service.py`""
Write-Host "Then start ProveIt in another terminal with: pnpm dev"
