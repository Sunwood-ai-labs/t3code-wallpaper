# T3 Code (Nightly) を壁紙付きで起動する。デバッグ用ポートは 127.0.0.1 限定。
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$cfg = Get-Content (Join-Path $dir 'config.json') -Raw | ConvertFrom-Json
$port = if ($cfg.port) { $cfg.port } else { 9333 }
$exe = Join-Path $env:LOCALAPPDATA 'Programs\t3code\T3 Code (Nightly).exe'
$running = Get-Process | Where-Object { $_.Name -eq 'T3 Code (Nightly)' }
$cdp = $false
try { Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/json/version" -TimeoutSec 2 | Out-Null; $cdp = $true } catch {}
if ($running -and -not $cdp) {
  Add-Type -AssemblyName System.Windows.Forms
  [void][System.Windows.Forms.MessageBox]::Show("T3 Code がすでに通常モードで起動しています。いったん終了してから、もう一度このショートカットを開いてください。", "T3 Code 壁紙")
  exit 1
}
if (-not $cdp) {
  Start-Process $exe -ArgumentList "--remote-debugging-port=$port", "--remote-debugging-address=127.0.0.1"
}
# 注入プロセスが二重に動かないようにする
$already = Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like "*t3code-wallpaper*inject.mjs*" }
if (-not $already) {
  Start-Process node -ArgumentList "`"$dir\inject.mjs`"" -WindowStyle Hidden
}
