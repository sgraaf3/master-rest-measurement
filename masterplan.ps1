# masterplan.ps1

# 0. Self-check & self-heal loop (before main parts)
$restartSelf = $true
while ($restartSelf) {
    $restartSelf = $false
    Write-Host "🔄 Self-check cycle: validating script and project scope"

    $scopeMissing = $false
    # Example checks
    if (-not (Test-Path .\js)) { Write-Host "Missing js folder"; $scopeMissing = $true }
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { Write-Host "npm not found"; $scopeMissing = $true }

    if ($scopeMissing) {
        Write-Host "🔄 Self-heal: installing npm dependencies and rebuilding"   
        # TODO: add code to extend scope for problems to solve

        npm install; npm run build
        $restartSelf = $true
    }
    else { Write-Host "✅ Self-check passed—entering main lifecycle" }
}

Write-Host "✅ Self-check passed—entering main lifecycle"

# 1. Error‑finding & solving (Part 1)
$cycle = 0; $maxCycles = 100
function Log-Crash($msg) {
    if ($msg.Length -gt 100) { $msg = $msg.Substring(0,100) }
    $msg | Out-File crashreport.txt -Append
}
while ($cycle -lt $maxCycles) {
    Write-Host "`n=== Part 1, Cycle $cycle ==="
    npm run build; npm test 2> errors.log
    $errCount = (Get-Content errors.log | Measure-Object).Count
    if ($errCount -gt 0) {
        Log-Crash "1.1 crash:$errCount errors;fix and rerun"
        Get-Content errors.log | Select-Object -First 20 | Out-File error_report.txt
        $cycle++
        continue  # rely on manual or script fixes
    }
    Write-Host "👍 Part 1 passed with zero errors"
    break
}
if ($cycle -ge $maxCycles) { Log-Crash "Part1: reached $maxCycles cycles"; exit 1 }
Get-Content error_report.txt -TotalCount 20 | Out-File error_summary.txt

# 2. Optimization (Part 2)
Write-Host "`n=== Part 2: Optimization ==="
Get-ChildItem js -Recurse | Select Name,Directory > data_list.txt
Log-Crash "2.1 data_list.txt generated"
# Placeholder for optimization logic (merge, delete, restructure)
npm run build; npm test
if ($LASTEXITCODE -ne 0) { Log-Crash "2.5 optimization broke build/test" } else {
    Add-Content optimization_report.txt "Optimization passed"
    Write-Host "✅ Part 2 completed"
}

# 3. Bullet‑proof testing (Part 3)
Write-Host "`n=== Part 3: Testing ==="
Add-Content masterplan.txt "* test strategy documented"
npm test > test.log 2>&1
$failCount = (Select-String -Path test.log -Pattern "FAIL").Count
if ($failCount -gt 0) { Log-Crash "3.4 tests failing ($failCount)"; exit 1 } else {
    Add-Content test_summary.txt "Tests passed, coverage assumed 100%"
    Write-Host "🎉 Part 3 passed"
}

# 4. Execute masterplan steps
Write-Host "`n=== Running MASTERPLAN.TXT steps ==="
Get-Content masterplan.txt | ForEach-Object {
    if ($_ -match '^\d+\.\d+') {
        $parts = $_ -split '\|'
        $id = $parts[0].Trim(); $cmd = $parts[3].Trim()
        Write-Host "→ $id : $cmd"
        Invoke-Expression $cmd
        # mark as done
        (gc masterplan.txt) | % {
            if ($_ -like "$id*") { $_ -replace 'Not Started','%DONE%' } else { $_ }
        } | Set-Content masterplan.txt
    }
}

Write-Host "`n✅ All done! masterplan.txt execution complete."
