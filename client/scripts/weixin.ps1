param(
    [string]$HBuilderXDirectory = 'D:\HBuilderX'
)

$ErrorActionPreference = 'Stop'
$clientDirectory = Split-Path -Parent $PSScriptRoot
$productionEnvironment = Join-Path $clientDirectory '.env.production'
if (!(Test-Path -LiteralPath $productionEnvironment -PathType Leaf)) {
    throw 'Production environment file not found: .env.production'
}
$productionApiEntries = @(Select-String -LiteralPath $productionEnvironment -Pattern '^VITE_API_BASE_URL=(.+)$')
if ($productionApiEntries.Count -ne 1) {
    throw 'Set exactly one VITE_API_BASE_URL in .env.production.'
}
$productionApi = $productionApiEntries[0].Matches[0].Groups[1].Value.Trim().Trim([char]34).Trim([char]39)
$productionUri = $null
if (![Uri]::TryCreate($productionApi, [UriKind]::Absolute, [ref]$productionUri) -or
    $productionUri.Scheme -ne 'https' -or $productionUri.IsLoopback -or
    $productionUri.UserInfo -or $productionUri.Query -or $productionUri.Fragment) {
    throw 'The production API must be an absolute HTTPS URL without credentials, query or fragment.'
}
if ($env:VITE_API_BASE_URL -and $env:VITE_API_BASE_URL -ne $productionApi) {
    throw 'VITE_API_BASE_URL in this process overrides .env.production. Clear the override before building.'
}
$nodeExecutable = Join-Path $HBuilderXDirectory 'plugins\node\node.exe'
$uniExecutable = Join-Path $HBuilderXDirectory 'plugins\uniapp-cli-vite\node_modules\@dcloudio\vite-plugin-uni\bin\uni.js'
if (!(Test-Path -LiteralPath $nodeExecutable) -or !(Test-Path -LiteralPath $uniExecutable)) {
    throw 'HBuilderX compiler not found. Specify its installation path with -HBuilderXDirectory.'
}
if (!(Test-Path -LiteralPath (Join-Path $clientDirectory 'manifest.json') -PathType Leaf)) {
    throw "Client manifest.json not found in: $clientDirectory"
}

$env:HX_APP_ROOT = $HBuilderXDirectory
$env:UNI_HBUILDERX_PLUGINS = Join-Path $HBuilderXDirectory 'plugins'
$env:UNI_INPUT_DIR = $clientDirectory
$env:UNI_APP_X = 'true'
$env:UNI_PLATFORM = 'mp-weixin'
$env:UNI_OUTPUT_DIR = Join-Path $clientDirectory 'unpackage\dist\build\mp-weixin'

Push-Location -LiteralPath $clientDirectory
try {
    & $nodeExecutable $uniExecutable build -p mp-weixin
    $buildExitCode = $LASTEXITCODE
} finally {
    Pop-Location
}
exit $buildExitCode
