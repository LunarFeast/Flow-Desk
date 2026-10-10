# Builds mb_FlowDesk.dll (MusicBee plugin) with the .NET Framework compiler already on this PC.
# No SDK, no NuGet, no VS: csc.exe + the winmds in System32\WinMetadata are enough.
# Output: app\plugin\dist\mb_FlowDesk.dll  (copy that into <MusicBee>\Plugins\)
# Keep this file ASCII-only: PowerShell 5.1 mis-parses BOM-less UTF-8.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$src  = @((Join-Path $here 'MBHeader.cs'), (Join-Path $here 'FlowDeskBridge.cs'))
$outDir = Join-Path $here 'dist'
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
$out = Join-Path $outDir 'mb_FlowDesk.dll'

$tmp = Join-Path $env:TEMP ('fd-plugin-ref-' + $PID)
New-Item -ItemType Directory -Path $tmp | Out-Null
# The compiler needs ONE WinRT metadata source. The SDK's aggregate Windows.winmd is the
# one that carries the projection surface we use (InMemoryRandomAccessStream implements
# IOutputStream, which only the aggregate spells out). System32\WinMetadata has no
# aggregate, so fall back to the per-namespace files if the SDK is missing.
# A .winmd cannot be referenced by that extension from the Framework csc, hence the copy.
$refs = New-Object System.Collections.ArrayList
$unionRoot = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\UnionMetadata'
$agg = Get-ChildItem $unionRoot -Recurse -Filter 'Windows.winmd' -ErrorAction SilentlyContinue |
       Where-Object { $_.Directory.Name -match '^\d+\.\d+\.\d+\.\d+$' } |
       Sort-Object { [version]$_.Directory.Name } -Descending | Select-Object -First 1
if ($agg) {
  'winmd source: aggregate ' + $agg.FullName
  $dst = Join-Path $tmp 'Windows.dll'
  Copy-Item $agg.FullName $dst -Force
  [void]$refs.Add('/r:' + $dst)
} else {
  'winmd source: per-namespace files (no SDK aggregate found)'
  $wm = Join-Path $env:SystemRoot 'System32\WinMetadata'
  foreach ($f in @('Windows.foundation', 'Windows.media', 'Windows.storage', 'Windows.graphics')) {
    $srcFile = Join-Path $wm ($f + '.winmd')
    if (-not (Test-Path $srcFile)) { continue }
    $dst = Join-Path $tmp ($f + '.dll')
    Copy-Item $srcFile $dst -Force
    [void]$refs.Add('/r:' + $dst)
  }
}

# BCL + the WinRT projection layer (AsStreamForWrite and the async/await extensions live there).
$fw = Join-Path $env:SystemRoot 'Microsoft.NET\Framework64\v4.0.30319'
foreach ($a in @('System.dll', 'System.Core.dll', 'System.Windows.Forms.dll')) {
  [void]$refs.Add('/r:' + (Join-Path $fw $a))
}
$gacRoot = Join-Path $env:SystemRoot 'Microsoft.NET\assembly'
foreach ($a in @('System.Runtime.WindowsRuntime', 'System.Runtime.InteropServices.WindowsRuntime',
                 # the winmds are .NET-Core-style metadata: their attribute types live in these facades
                 'System.Runtime', 'netstandard', 'System.ObjectModel')) {
  $hit = Get-ChildItem (Join-Path $gacRoot ('GAC_MSIL\' + $a)) -Recurse -Filter '*.dll' -ErrorAction SilentlyContinue |
         Select-Object -First 1
  if (-not $hit) { $hit = Get-ChildItem (Join-Path $fw ($a + '.dll')) -ErrorAction SilentlyContinue | Select-Object -First 1 }
  if ($hit) { [void]$refs.Add('/r:' + $hit.FullName) }
  elseif ($a -like 'System.Runtime.*') { throw 'not found: ' + $a }
}

$csc = Join-Path $fw 'csc.exe'
if (-not (Test-Path $csc)) { throw 'csc.exe not found: ' + $csc }

# Pass everything through a response file: the paths contain spaces, and PowerShell's
# native-argument quoting is the usual way a build like this silently breaks.
$rsp = Join-Path $tmp 'build.rsp'
$lines = New-Object System.Collections.ArrayList
foreach ($l in @('/nologo', '/target:library', '/platform:anycpu', '/optimize+', '/nowarn:0618')) {
  [void]$lines.Add($l)
}
[void]$lines.Add('/out:"' + $out + '"')
foreach ($r in $refs) { [void]$lines.Add('/r:"' + ($r -replace '^/r:', '') + '"') }
foreach ($s in $src) { [void]$lines.Add('"' + $s + '"') }
Set-Content -Path $rsp -Value $lines -Encoding ASCII

'csc: ' + $csc
foreach ($l in $lines) { '  ' + $l }
& $csc ('@' + $rsp)
$code = $LASTEXITCODE
Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
if ($code -ne 0) { 'BUILD FAILED (' + $code + ')'; exit $code }
'built ' + $out + '  ' + ((Get-Item $out).Length) + ' bytes'
