param(
    [switch]$Build,
    [string]$HBuilderXDirectory = 'D:\HBuilderX',
    [string]$ApiBaseUrl = '',
    [int]$Port = 5173
)

$ErrorActionPreference = 'Stop'
$clientDirectory = Split-Path -Parent $PSScriptRoot
if (!(Test-Path -LiteralPath (Join-Path $clientDirectory 'manifest.json') -PathType Leaf)) {
    throw "Client manifest.json not found in: $clientDirectory"
}
$nodeExecutable = Join-Path $HBuilderXDirectory 'plugins\node\node.exe'
$uniExecutable = Join-Path $HBuilderXDirectory 'plugins\uniapp-cli-vite\node_modules\@dcloudio\vite-plugin-uni\bin\uni.js'
if (!(Test-Path -LiteralPath $nodeExecutable) -or !(Test-Path -LiteralPath $uniExecutable)) {
    throw 'HBuilderX compiler not found. Specify its installation path with -HBuilderXDirectory.'
}

$env:HX_APP_ROOT = $HBuilderXDirectory
$env:UNI_HBUILDERX_PLUGINS = Join-Path $HBuilderXDirectory 'plugins'
$env:UNI_INPUT_DIR = $clientDirectory
$env:UNI_APP_X = 'true'
# Set the platform before loading the CLI so it resolves the HBuilderX Sass plugin.
$env:UNI_PLATFORM = 'h5'
if ($ApiBaseUrl) { $env:VITE_API_BASE_URL = $ApiBaseUrl }

Set-Location -LiteralPath $clientDirectory
if ($Build) {
    $env:UNI_OUTPUT_DIR = Join-Path $clientDirectory 'unpackage\dist\build\h5'
    & $nodeExecutable $uniExecutable build -p h5
} else {
    $env:UNI_OUTPUT_DIR = Join-Path $clientDirectory 'unpackage\dist\dev\h5'
    & $nodeExecutable $uniExecutable -p h5 --host 127.0.0.1 --port $Port --strictPort
}
exit $LASTEXITCODE
