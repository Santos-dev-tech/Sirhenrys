param(
  [string]$Slug = 'carlo-navy',
  [string]$Garment = 'an impeccably tailored navy blue three-piece suit with peak lapels, a crisp white shirt, a dark navy tie and polished black oxford shoes',
  [int]$Seed = 71067
)

# Generate a 360 turnaround by anchoring every angle to one master frame.
# Soul 2.0 takes a single image reference plus a seed, which together hold the garment,
# the model and the lighting steady while only the body orientation changes.

$hf   = "$env:LOCALAPPDATA\nodejs-portable\node-v24.19.0-win-x64\node_modules\@higgsfield\cli\vendor\hf.exe"
$img  = Join-Path $PSScriptRoot "..\assets\img"
$master = Join-Path $img "spin-$Slug-000.png"

$spine = "Full-length high fashion editorial photograph of the SAME man in the SAME outfit as the reference image, wearing $Garment, standing in a bright infinite seamless white cyclorama studio, soft even diffused studio light, subtle soft contact shadow on the pale floor, absolutely no background objects or props. {0}. Identical garment, identical fabric, identical shoes, identical lighting and identical framing as the reference. Luxury menswear campaign, editorial fashion photography, natural skin texture, sharp fabric weave detail, full length, head to toe, entire body and shoes in frame."

$views = @(
  @{ d = 45;  v = "His whole body is rotated slightly to his left so the camera sees a front three-quarter view" },
  @{ d = 90;  v = "His whole body is rotated to face left so the camera sees him in complete side profile" },
  @{ d = 135; v = "His whole body is rotated away to his left so the camera sees a rear three-quarter view" },
  @{ d = 180; v = "He has his back fully to the camera so the camera sees the entire back of the garment" },
  @{ d = 225; v = "His whole body is rotated away to his right so the camera sees a rear three-quarter view from the opposite side" },
  @{ d = 270; v = "His whole body is rotated to face right so the camera sees him in complete side profile from the opposite side" },
  @{ d = 315; v = "His whole body is rotated slightly to his right so the camera sees a front three-quarter view from the opposite side" }
)

if (-not (Test-Path $master)) { Write-Host "master frame missing: $master"; exit 1 }
Write-Host "anchoring 7 angles to $(Split-Path $master -Leaf) (seed $Seed)"

foreach ($view in $views) {
  $target = Join-Path $img ("spin-{0}-{1:d3}.png" -f $Slug, $view.d)
  if (Test-Path $target) { Write-Host ("skip {0}" -f $view.d); continue }

  $prompt = $spine -f $view.v
  $raw = & $hf generate create text2image_soul_v2 `
      --prompt $prompt `
      --image $master `
      --seed $Seed `
      --aspect_ratio "3:4" --quality 2k --wait 2>&1

  $m = [regex]::Match(($raw -join "`n"), 'https://\S+?\.png')
  if ($m.Success) {
    Invoke-WebRequest -UseBasicParsing -Uri $m.Value -OutFile $target
    Write-Host ("OK   {0} deg" -f $view.d)
  } else {
    Write-Host ("FAIL {0} deg :: {1}" -f $view.d, (($raw | Select-Object -Last 2) -join ' '))
  }
}

$n = @(Get-ChildItem $img -Filter "spin-$Slug-*.png").Count
Write-Host "DONE. $n angles for $Slug"
