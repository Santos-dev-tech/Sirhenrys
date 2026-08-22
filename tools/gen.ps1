param([int]$Throttle = 6)

$hf   = "$env:LOCALAPPDATA\nodejs-portable\node-v24.19.0-win-x64\node_modules\@higgsfield\cli\vendor\hf.exe"
$out  = Join-Path $PSScriptRoot "..\assets\img"
$jobs = Get-Content (Join-Path $PSScriptRoot "jobs.json") -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $out | Out-Null

Write-Host "Queueing $($jobs.Count) plates (throttle $Throttle)"
$running = @()

foreach ($j in $jobs) {
  $target = Join-Path $out "$($j.n).png"
  if (Test-Path $target) { Write-Host "skip $($j.n)"; continue }

  while (@($running | Where-Object { $_.State -eq 'Running' }).Count -ge $Throttle) { Start-Sleep -Milliseconds 700 }

  $running += Start-Job -ScriptBlock {
    param($hf, $name, $prompt, $aspect, $target)
    try {
      $raw = & $hf generate create text2image_soul_v2 --prompt $prompt --aspect_ratio $aspect --quality 2k --wait 2>&1
      $m = [regex]::Match(($raw -join "`n"), 'https://\S+?\.png')
      if ($m.Success) {
        Invoke-WebRequest -UseBasicParsing -Uri $m.Value -OutFile $target
        "OK   $name"
      } else {
        "FAIL $name :: $(($raw | Select-Object -Last 2) -join ' ')"
      }
    } catch { "ERR  $name :: $($_.Exception.Message)" }
  } -ArgumentList $hf, $j.n, $j.p, $j.a, $target
}

$running | Wait-Job | Out-Null
$running | ForEach-Object { Receive-Job $_ } | ForEach-Object { Write-Host $_ }
$running | Remove-Job -Force

$made = @(Get-ChildItem $out -Filter *.png -ErrorAction SilentlyContinue)
Write-Host "DONE. $($made.Count)/$($jobs.Count) plates in assets/img"
