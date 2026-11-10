# Desinstala los artefactos descargados por el instalador (motores, modelos, Node.js
# portable, registros y descargas temporales) y conserva el codigo y las imagenes.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File scripts/uninstall.ps1 [-Force]
[CmdletBinding()]
param([switch]$Force)
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $ProjectRoot

function Format-Size([double]$Bytes) {
    if ($Bytes -ge 1GB) { return ('{0:N1} GB' -f ($Bytes / 1GB)) }
    if ($Bytes -ge 1MB) { return ('{0:N0} MB' -f ($Bytes / 1MB)) }
    if ($Bytes -ge 1KB) { return ('{0:N0} KB' -f ($Bytes / 1KB)) }
    return "$([int]$Bytes) B"
}
function Get-Size([string]$Path) {
    if (!(Test-Path -LiteralPath $Path)) { return 0 }
    $Item = Get-Item -LiteralPath $Path -Force
    if (!$Item.PSIsContainer) { return $Item.Length }
    $Sum = 0
    Get-ChildItem -LiteralPath $Path -Recurse -File -Force -ErrorAction SilentlyContinue |
        ForEach-Object { $Sum += $_.Length }
    return $Sum
}
function Assert-Inside([string]$Path) {
    $Full = [IO.Path]::GetFullPath($Path)
    $Root = [IO.Path]::GetFullPath($ProjectRoot).TrimEnd('\')
    if ($Full -eq $Root -or !$Full.StartsWith($Root + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw "Ruta fuera de la carpeta de la app: $Full"
    }
    return $Full
}

$Config = Get-Content -LiteralPath (Join-Path $ProjectRoot 'model-config.json') -Raw | ConvertFrom-Json
$Targets = @()
$Runtimes = @($Config.runtime, $Config.runtimeCpu, $Config.runtimeVulkan) |
    Where-Object { $_ } | Select-Object -Unique
foreach ($Name in $Runtimes) { $Targets += (Join-Path $ProjectRoot $Name) }
# Motores de versiones anteriores que ya no aparecen en la configuracion.
Get-ChildItem -LiteralPath $ProjectRoot -Directory -Filter 'runtime-*' -ErrorAction SilentlyContinue |
    ForEach-Object { $Targets += $_.FullName }
$Targets += (Join-Path $ProjectRoot 'node')
$Targets += (Join-Path $ProjectRoot 'logs')
$Targets += (Join-Path $ProjectRoot '.downloads')
$Targets += (Join-Path $ProjectRoot 'models\loras')
$Targets += (Join-Path $ProjectRoot 'model-selection.json')
$Targets += (Join-Path $ProjectRoot 'model-selection.pending.json')
$Targets = @($Targets | Select-Object -Unique)

# Pesos y metadatos sueltos de models\; las licencias se conservan.
$ModelFiles = @()
$ModelsDir = Join-Path $ProjectRoot 'models'
if (Test-Path -LiteralPath $ModelsDir) {
    $ModelFiles = Get-ChildItem -LiteralPath $ModelsDir -File -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Extension -in @('.gguf', '.safetensors', '.part') -or $_.Name -in @('merged-lora.json', 'lora-compatibility.json') } |
        ForEach-Object { $_.FullName }
}

$Present = @($Targets | Where-Object { Test-Path -LiteralPath $_ })
$Total = 0
foreach ($Target in $Present) { $Total += (Get-Size $Target) }
foreach ($File in $ModelFiles) { $Total += (Get-Size $File) }

Write-Host ''
Write-Host 'Se eliminaran los archivos descargados por el instalador:' -ForegroundColor Cyan
foreach ($Target in $Present) {
    $Label = Split-Path $Target -Leaf
    if ((Split-Path $Target -Parent) -eq (Join-Path $ProjectRoot 'models')) { $Label = 'models\' + $Label }
    if ((Get-Item -LiteralPath $Target -Force).PSIsContainer) { $Label += '\' }
    Write-Host ('  {0,-26} {1}' -f $Label, (Format-Size (Get-Size $Target)))
}
if ($ModelFiles.Count) {
    Write-Host ('  {0,-26} {1}' -f 'pesos de models\', (Format-Size (($ModelFiles | ForEach-Object { (Get-Item -LiteralPath $_).Length } | Measure-Object -Sum).Sum)))
}
if (!$Present.Count -and !$ModelFiles.Count) {
    Write-Host '  (nada que borrar: la app ya esta limpia)'
}
Write-Host ''
Write-Host ('Espacio a liberar: ' + (Format-Size $Total))
Write-Host 'Se conservaran el codigo, la configuracion y las imagenes de outputs\.' -ForegroundColor Green
Write-Host 'No se puede deshacer: para volver a usar la app tendras que ejecutar el instalador.'
Write-Host ''

if (!$Force) {
    $Answer = Read-Host 'Desinstalar ahora? [s/N]'
    if ($Answer -notmatch '^(s|si|y|yes)$') {
        Write-Host 'Desinstalacion cancelada. No se borro nada.' -ForegroundColor Yellow
        exit 0
    }
}

$StopScript = Join-Path $PSScriptRoot 'stop.ps1'
if (Test-Path -LiteralPath $StopScript) {
    Write-Host 'Deteniendo la app...'
    try { & $StopScript } catch { Write-Warning ('No se pudo detener la app: ' + $_.Exception.Message) }
    # Deja que el sistema libere los archivos antes de borrar logs\.
    Start-Sleep -Milliseconds 700
}

$Failed = @()
foreach ($Target in $Targets) {
    if (!(Test-Path -LiteralPath $Target)) { continue }
    try {
        Assert-Inside $Target | Out-Null
        Remove-Item -LiteralPath $Target -Recurse -Force
        Write-Host ('  borrado ' + (Split-Path $Target -Leaf))
    } catch {
        $Failed += ((Split-Path $Target -Leaf) + ': ' + $_.Exception.Message)
    }
}
foreach ($File in $ModelFiles) {
    if (!(Test-Path -LiteralPath $File)) { continue }
    try {
        Assert-Inside $File | Out-Null
        Remove-Item -LiteralPath $File -Force
        Write-Host ('  borrado models\' + (Split-Path $File -Leaf))
    } catch {
        $Failed += ('models\' + (Split-Path $File -Leaf) + ': ' + $_.Exception.Message)
    }
}

Write-Host ''
if ($Failed.Count) {
    Write-Warning 'La desinstalacion termino con avisos:'
    foreach ($Item in $Failed) { Write-Warning ('  ' + $Item) }
    exit 1
}

$Outputs = Join-Path $ProjectRoot 'outputs'
$Images = 0
if (Test-Path -LiteralPath $Outputs) {
    $Images = @(Get-ChildItem -LiteralPath $Outputs -Filter '*.png' -File -ErrorAction SilentlyContinue).Count
}
Write-Host ('Desinstalacion completa. Espacio liberado: ' + (Format-Size $Total)) -ForegroundColor Green
if ($Images) {
    Write-Host ("Tus $Images imagenes siguen en outputs\.") -ForegroundColor Green
} else {
    Write-Host 'Las imagenes de outputs\ no se tocaron.' -ForegroundColor Green
}
Write-Host 'El codigo y la configuracion se conservaron. Ejecuta "Instalar Qwen Imagen Studio.cmd" para volver a instalar.'
