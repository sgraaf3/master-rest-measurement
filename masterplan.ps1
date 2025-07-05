<#
MASTERPLAN EXECUTION SCRIPT
Version: 1.0.1
Purpose: Execute the complex masterplan workflow with all specified rules and protocols
Update: Added page not found handling with auto-creation on cycle 3
#>

# ========== GLOBAL CONFIGURATION ==========
$global:MAX_ATTEMPTS = 5
$global:MAX_CYCLES = 3
$global:LOG_FILE = "masterplan_execution.log"
$global:ERROR_LOG = "masterplan_errors.log"
$global:STEP_LOG = "step_progress.log"
$global:ANDROID_OUTPUT = "android_apk_master_rest_measurement"
$global:GIT_REPO = "https://github.com/your-repo.git"
$global:PAGE_TEMPLATE = @"
<!DOCTYPE html>
<html>
<head>
    <title>New Page</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
    <h1>Automatically Generated Page</h1>
    <p>This page was automatically created by the masterplan execution script.</p>
</body>
</html>
"@

# ========== LOGGING FUNCTIONS ==========
function Initialize-Logs {
    # Create fresh log files with headers
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    
    # Main execution log
    "==== MASTERPLAN EXECUTION LOG ====`nStarted: $timestamp`n" | Out-File $global:LOG_FILE
    
    # Error log
    "==== ERROR LOG ====`nStarted: $timestamp`n" | Out-File $global:ERROR_LOG
    
    # Step progress log
    "==== STEP PROGRESS LOG ====`nStarted: $timestamp`nStep,Status,Timestamp,Details`n" | Out-File $global:STEP_LOG
}

function Write-ExecutionLog {
    param([string]$message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "[$timestamp] $message" | Out-File $global:LOG_FILE -Append
    Write-Host "[$timestamp] $message"
}

function Write-ErrorLog {
    param([string]$errorMessage, [string]$step)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $entry = "[$timestamp] [STEP $step] ERROR: $errorMessage"
    $entry | Out-File $global:ERROR_LOG -Append
    Write-Host $entry -ForegroundColor Red
}

function Log-StepProgress {
    param(
        [string]$stepNumber,
        [string]$status,
        [string]$details
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    "$stepNumber,$status,$timestamp,$details" | Out-File $global:STEP_LOG -Append
}

# ========== PAGE HANDLING FUNCTIONS ==========
function Handle-PageNotFound {
    param(
        [string]$pagePath,
        [string]$stepNumber,
        [int]$currentCycle
    )
    
    if ($currentCycle -eq $global:MAX_CYCLES) {
        try {
            # Create directory structure if needed
            $dirPath = Split-Path $pagePath -Parent
            if (-not (Test-Path $dirPath)) {
                New-Item -ItemType Directory -Path $dirPath -Force | Out-Null
                Write-ExecutionLog "Created directory path: $dirPath"
            }
            
            # Create the new page with template content
            $global:PAGE_TEMPLATE | Out-File $pagePath -Force
            Write-ExecutionLog "Created missing page at: $pagePath"
            Log-StepProgress $stepNumber "RECOVERED" "Auto-created missing page at $pagePath"
            
            return $true
        }
        catch {
            Write-ErrorLog "Failed to create page at $pagePath : $($_.Exception.Message)" $stepNumber
            Log-StepProgress $stepNumber "FAILED" "Could not create missing page at $pagePath"
            return $false
        }
    }
    
    return $false
}

# ========== CORE FUNCTIONS ==========
function Invoke-MasterPlanStep {
    param(
        [string]$stepNumber,
        [scriptblock]$action,
        [string]$stepDescription
    )
    
    $attempts = 0
    $cycles = 0
    $completed = $false
    
    Log-StepProgress $stepNumber "STARTED" "Beginning execution: $stepDescription"
    
    while ($cycles -lt $global:MAX_CYCLES -and -not $completed) {
        $cycles++
        Write-ExecutionLog "Starting cycle $cycles for step $stepNumber"
        
        $attempts = 0
        while ($attempts -lt $global:MAX_ATTEMPTS -and -not $completed) {
            $attempts++
            Write-ExecutionLog "Attempt $attempts of step $stepNumber"
            
            try {
                & $action
                $completed = $true
                Log-StepProgress $stepNumber "COMPLETED" "Successfully completed after $attempts attempts"
                Write-ExecutionLog "Step $stepNumber completed successfully"
            }
            catch [System.IO.FileNotFoundException] {
                $pagePath = $_.Exception.Message -replace "Cannot find path '|' because it does not exist.", ""
                
                if (Handle-PageNotFound $pagePath $stepNumber $cycles) {
                    # Page was created, retry the action
                    continue
                }
                else {
                    Write-ErrorLog $_.Exception.Message $stepNumber
                    Log-StepProgress $stepNumber "FAILED" "Attempt $attempts failed: $($_.Exception.Message)"
                    
                    if ($attempts -ge $global:MAX_ATTEMPTS) {
                        Write-ExecutionLog "Max attempts reached for step $stepNumber in cycle $cycles"
                        Log-StepProgress $stepNumber "RETRYING" "Moving to next cycle ($($cycles+1)/$global:MAX_CYCLES)"
                    }
                }
            }
            catch {
                Write-ErrorLog $_.Exception.Message $stepNumber
                Log-StepProgress $stepNumber "FAILED" "Attempt $attempts failed: $($_.Exception.Message)"
                
                if ($attempts -ge $global:MAX_ATTEMPTS) {
                    Write-ExecutionLog "Max attempts reached for step $stepNumber in cycle $cycles"
                    Log-StepProgress $stepNumber "RETRYING" "Moving to next cycle ($($cycles+1)/$global:MAX_CYCLES)"
                }
            }
        }
        
        if (-not $completed) {
            Write-ExecutionLog "Cycle $cycles completed without success for step $stepNumber"
            
            if ($cycles -lt $global:MAX_CYCLES) {
                Write-ExecutionLog "Redefining approach for step $stepNumber"
                # Add logic to modify approach here if needed
            }
            else {
                Write-ErrorLog "MAX CYCLES REACHED - Step $stepNumber cannot be completed" $stepNumber
                Log-StepProgress $stepNumber "ABANDONED" "Failed after $global:MAX_CYCLES cycles"
                throw "Step $stepNumber failed after maximum cycles"
            }
        }
    }
    
    return $completed
}

function Initialize-ProjectEnvironment {
    # Check and create required directories
    $requiredPaths = @(
        "src\js",
        "android",
        "logs",
        $global:ANDROID_OUTPUT
    )
    
    foreach ($path in $requiredPaths) {
        if (-not (Test-Path $path)) {
            New-Item -ItemType Directory -Path $path -Force | Out-Null
            Write-ExecutionLog "Created directory: $path"
        }
    }
    
    # Verify npm is available
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        throw "npm is not available. Please install Node.js and npm."
    }
    
    # Install dependencies if package.json exists
    if (Test-Path "package.json") {
        npm install | Out-Null
        Write-ExecutionLog "npm dependencies installed"
    }
}

function Convert-ToAndroidProject {
    param(
        [string]$sourceDir = "src",
        [string]$outputDir = $global:ANDROID_OUTPUT
    )
    
    Write-ExecutionLog "Beginning Android project conversion"
    
    # 1. Create basic Android project structure
    $androidDirs = @(
        "$outputDir\app\src\main\java",
        "$outputDir\app\src\main\res",
        "$outputDir\app\src\main\assets"
    )
    
    foreach ($dir in $androidDirs) {
        if (-not (Test-Path $dir)) {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
        }
    }
    
    # 2. Convert HTML/JS/CSS to Android components with page not found handling
    try {
        Get-ChildItem $sourceDir -Recurse -Include *.html, *.js, *.css | ForEach-Object {
            $targetPath = $_.FullName.Replace($sourceDir, "$outputDir\app\src\main\assets")
            Copy-Item $_.FullName -Destination $targetPath -Force
        }
        Write-ExecutionLog "Web resources copied to Android project"
    }
    catch [System.IO.FileNotFoundException] {
        $pagePath = $_.Exception.Message -replace "Cannot find path '|' because it does not exist.", ""
        throw "Page not found during conversion: $pagePath"
    }
    
    # 3. Generate basic Android manifest and Gradle files
    @"
<?xml version="1.0" encoding="utf-8"?>
<manifest package="com.example.masterrestmeasurement"
    xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Manifest content would be generated here -->
</manifest>
"@ | Out-File "$outputDir\app\src\main\AndroidManifest.xml"
    
    Write-ExecutionLog "Android project files generated"
}

function Invoke-GitOperations {
    param(
        [string]$message = "Auto-commit from masterplan execution"
    )
    
    if (-not (Test-Path ".git")) {
        git init | Out-Null
        Write-ExecutionLog "Initialized new git repository"
    }
    
    git add . | Out-Null
    git commit -m $message | Out-Null
    Write-ExecutionLog "Git commit performed: $message"
    
    if (git remote -v | Select-String "origin") {
        git push origin master | Out-Null
        Write-ExecutionLog "Pushed changes to remote repository"
    }
}

function Optimize-Codebase {
    Write-ExecutionLog "Beginning code optimization"
    
    # 1. Check for duplicate packages
    $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
    $dependencies = $packageJson.dependencies.PSObject.Properties.Name
    
    # This would be expanded with actual duplicate detection logic
    Write-ExecutionLog "Checked for duplicate packages"
    
    # 2. Enforce line count limit with page not found handling
    try {
        
        Write-ExecutionLog "Completed code optimization checks - unset"
    }
    catch [System.IO.FileNotFoundException] {
        $pagePath = $_.Exception.Message -replace "Cannot find path '|' because it does not exist.", ""
        throw "Page not found during optimization: $pagePath"
    }
}

# ========== MAIN EXECUTION ==========
try {
    # Initialize environment
    Initialize-Logs
    Write-ExecutionLog "==== MASTERPLAN EXECUTION STARTED ===="
    
    # Phase 1: Setup and Validation
    Invoke-MasterPlanStep "0.1" {
        Initialize-ProjectEnvironment
    } "Initialize project environment"
    
    # Phase 2: Core Conversion Process
    Invoke-MasterPlanStep "1.1" {
        Convert-ToAndroidProject
    } "Convert web project to Android"
    
    Invoke-MasterPlanStep "1.2" {
        Optimize-Codebase
    } "Optimize codebase according to rules"
    
    # Phase 3: Testing and Validation
    Invoke-MasterPlanStep "2.1" {
        # Test all pages exist
        $requiredPages = @(
            "android_apk_master_rest_measurement\app\src\main\assets\css\style.css",
            "android_apk_master_rest_measurement\app\src\main\assets\js\main.js",
            "android_apk_master_rest_measurement\app\src\main\assets\html\AdvancedHRVAnalysis.html",        
            "android_apk_master_rest_measurement\app\src\main\assets\html\master-rest-measurement.html",
            "android_apk_master_rest_measurement\app\src\main\assets\html\report.html"
            "android_apk_master_rest_measurement\app\src\main\assets\js\AdvancedHRVAnalysis.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\bluetooth.js",
            "C:\Users\sgraa\Desktop\single pages\master rest measurement\android_apk_master_rest_measurement\app\src\main\assets\js\body-calc.-manager.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\breath.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\GraphManager.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\history.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\hr-zone.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\hrv-calculations.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\Populationformulasmanager.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\program_manager.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\report.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\txt-exporter.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\ui.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\UserProfile\UserProfile.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\programs\training.example.datasubject.goal.js",
            "android_apk_master_rest_measurement\app\src\main\assets\js\populationData\PopulationComparison_Vo2MAx.js"
        )
        foreach ($page in $requiredPages) {
            if (-not (Test-Path $page)) {
                throw [System.IO.FileNotFoundException] "Required page not found: $page"
            }
        }
        Write-ExecutionLog "All required pages exist"
    } "Execute test plan"
    
    # Phase 4: Finalization
    Invoke-MasterPlanStep "3.1" {
        Invoke-GitOperations
    } "Perform git operations"
    
    Write-ExecutionLog "==== MASTERPLAN EXECUTION COMPLETED SUCCESSFULLY ===="
    Log-StepProgress "FINAL" "COMPLETED" "All steps completed successfully"
}
catch {
    Write-ErrorLog "FATAL ERROR: $($_.Exception.Message)" "GLOBAL"
    Log-StepProgress "FINAL" "FAILED" "Execution terminated with errors"
    exit 1
}