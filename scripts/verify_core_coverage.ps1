[CmdletBinding()]
param(
    [ValidateSet('Debug', 'Release')]
    [string]$Configuration = 'Release'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$testProject = Join-Path $repoRoot 'tests\AHUVerification.Tests\AHUVerification.Tests.csproj'
$baselinePath = Join-Path $repoRoot 'docs\operations\coverage-baseline.json'
$runId = Get-Date -Format 'yyyyMMdd-HHmmssfff'
$resultsDirectory = Join-Path $repoRoot ("TestResults\coverage-core\$runId")

New-Item -ItemType Directory -Path $resultsDirectory -Force | Out-Null

if (-not (Test-Path -LiteralPath $baselinePath)) {
    throw "Coverage baseline is missing: $baselinePath"
}

$baseline = Get-Content -LiteralPath $baselinePath -Raw | ConvertFrom-Json
if ($baseline.schemaVersion -ne 'ahu-core-coverage-v1' -or $baseline.targetAssembly -ne 'AHUVerification.Core') {
    throw "Coverage baseline has an unsupported schema or target assembly: $baselinePath"
}

$criticalModules = @($baseline.modules | ForEach-Object {
    if ([string]::IsNullOrWhiteSpace($_.name) -or [string]::IsNullOrWhiteSpace($_.type)) {
        throw 'Coverage baseline contains a module without name or type.'
    }
    [pscustomobject]@{
        Name = [string]$_.name
        TypeName = [string]$_.type
        BaselineLineRate = [double]$_.minLineRate
        BaselineBranchRate = [double]$_.minBranchRate
    }
})
if ($criticalModules.Count -eq 0) {
    throw "Coverage baseline contains no critical modules: $baselinePath"
}

$dotnetArguments = @(
    'test'
    $testProject
    '--configuration'
    $Configuration
    '--collect:XPlat Code Coverage;Format=cobertura'
    '--results-directory'
    $resultsDirectory
    '--logger'
    'console;verbosity=minimal'
    '--logger'
    'trx;LogFileName=ahu-verification-coverage.trx'
    '--'
    'DataCollectionRunSettings.DataCollectors.DataCollector.Configuration.Include=[AHUVerification.Core]*'
)

Write-Output "Running Core coverage gate in $Configuration configuration."
& dotnet @dotnetArguments
$testExitCode = $LASTEXITCODE

$coverageReport = Get-ChildItem -Path $resultsDirectory -Filter 'coverage.cobertura.xml' -File -Recurse |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

if ($null -eq $coverageReport) {
    throw "Coverlet did not produce coverage.cobertura.xml under $resultsDirectory."
}

[xml]$coverageXml = Get-Content -LiteralPath $coverageReport.FullName -Raw
$corePackages = @($coverageXml.coverage.packages.package | Where-Object { $_.name -eq 'AHUVerification.Core' })
if ($corePackages.Count -ne 1) {
    throw "Expected exactly one AHUVerification.Core package in $($coverageReport.FullName), found $($corePackages.Count)."
}

$corePackage = $corePackages[0]
$coverageFailures = @()
$moduleResults = @()

foreach ($module in $criticalModules) {
    $classes = @($corePackage.classes.class | Where-Object { $_.name -eq $module.TypeName })
    if ($classes.Count -ne 1) {
        $coverageFailures += "$($module.Name): expected one class entry for $($module.TypeName), found $($classes.Count)."
        continue
    }

    $lines = @($classes[0].methods.method | ForEach-Object { @($_.lines.line) })
    if ($lines.Count -eq 0) {
        $coverageFailures += "$($module.Name): class has no measurable lines in the Cobertura report."
        continue
    }

    $lineCovered = @($lines | Where-Object { [int]$_.hits -gt 0 }).Count
    $lineRate = $lineCovered / [double]$lines.Count
    $branchCovered = 0
    $branchValid = 0

    foreach ($line in @($lines | Where-Object { $_.branch -eq 'true' })) {
        $match = [regex]::Match([string]$line.'condition-coverage', '\((\d+)\/(\d+)\)')
        if (-not $match.Success) {
            $coverageFailures += "$($module.Name): could not parse branch coverage '$($line.'condition-coverage')'."
            continue
        }

        $branchCovered += [int]$match.Groups[1].Value
        $branchValid += [int]$match.Groups[2].Value
    }

    if ($branchValid -eq 0) {
        $coverageFailures += "$($module.Name): class has no measurable branches in the Cobertura report."
        $branchRate = 0.0
    } else {
        $branchRate = $branchCovered / [double]$branchValid
    }

    $linePass = $lineRate -ge $module.BaselineLineRate
    $branchPass = $branchRate -ge $module.BaselineBranchRate
    if (-not $linePass) {
        $coverageFailures += "$($module.Name): line coverage $('{0:P2}' -f $lineRate) is below baseline $('{0:P2}' -f $module.BaselineLineRate)."
    }
    if (-not $branchPass) {
        $coverageFailures += "$($module.Name): branch coverage $('{0:P2}' -f $branchRate) is below baseline $('{0:P2}' -f $module.BaselineBranchRate)."
    }

    $moduleResults += [ordered]@{
        name = $module.Name
        type = $module.TypeName
        lineCovered = $lineCovered
        lineValid = $lines.Count
        lineRate = [math]::Round($lineRate, 4)
        baselineLineRate = $module.BaselineLineRate
        branchCovered = $branchCovered
        branchValid = $branchValid
        branchRate = [math]::Round($branchRate, 4)
        baselineBranchRate = $module.BaselineBranchRate
        passed = ($linePass -and $branchPass)
    }
}

$summary = [ordered]@{
    schemaVersion = 'ahu-core-coverage-v1'
    targetAssembly = 'AHUVerification.Core'
    configuration = $Configuration
    testProject = 'tests/AHUVerification.Tests/AHUVerification.Tests.csproj'
    collector = 'coverlet.collector 6.0.4'
    baseline = 'docs/operations/coverage-baseline.json'
    coverageReport = $coverageReport.FullName
    testExitCode = $testExitCode
    modules = $moduleResults
    failures = $coverageFailures
    passed = ($testExitCode -eq 0 -and $coverageFailures.Count -eq 0)
}

$summaryPath = Join-Path $resultsDirectory 'coverage-summary.json'
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath -Encoding utf8

foreach ($result in $moduleResults) {
    $lineText = '{0:P2}' -f $result.lineRate
    $lineBaselineText = '{0:P2}' -f $result.baselineLineRate
    $branchText = '{0:P2}' -f $result.branchRate
    $branchBaselineText = '{0:P2}' -f $result.baselineBranchRate
    $statusText = if ($result.passed) { 'PASS' } else { 'FAIL' }
    Write-Output ("{0}: line {1} (min {2}); branch {3} (min {4}); {5}" -f $result.name, $lineText, $lineBaselineText, $branchText, $branchBaselineText, $statusText)
}

Write-Output "Coverage summary: $summaryPath"
Write-Output ('COVERAGE_SUMMARY_JSON={0}' -f (($summary | ConvertTo-Json -Depth 6 -Compress)))

if ($testExitCode -ne 0) {
    Write-Error "The .NET test command exited with $testExitCode; coverage cannot be accepted while tests fail."
}
if ($coverageFailures.Count -gt 0) {
    $coverageFailures | ForEach-Object { Write-Error $_ }
}

if ($testExitCode -ne 0 -or $coverageFailures.Count -gt 0) {
    exit 1
}

exit 0
