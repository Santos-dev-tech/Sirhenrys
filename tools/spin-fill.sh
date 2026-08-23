#!/usr/bin/env bash
# Fill in the intermediate angles of a turnaround using Nano Banana Pro, the one model
# tested that genuinely reorients a subject rather than reproducing the reference pose.
#
# Every result URL is written to tools/spin-urls.txt BEFORE anything is deleted or moved,
# so a paid generation can always be recovered. Learned that the hard way.

set -u
HF="$LOCALAPPDATA/nodejs-portable/node-v24.19.0-win-x64/node_modules/@higgsfield/cli/vendor/hf.exe"
ROOT="C:/Users/ADMIN/New folder (2)/sirhenrys"
IMG="$ROOT/assets/img"
MASTER="$IMG/spin-carlo-navy-000.jpg"
LOG="$ROOT/tools/spin-urls.txt"

gen () {
  local deg="$1" view="$2"
  local out="$IMG/spin-carlo-navy-${deg}.png"
  if [ -f "${out%.png}.jpg" ]; then echo "skip $deg (already have it)"; return; fi

  local prompt="Show this same man wearing this same navy three-piece suit, but photographed from a different angle: ${view}. He stands upright in the same white studio with the same lighting and the same distance from camera; only the direction his body faces changes. Keep the suit, shirt, tie, shoes, studio floor and lighting identical to the reference. Full length portrait, head to toe, upright, one person."

  local raw url
  raw=$("$HF" generate create nano_banana_pro --prompt "$prompt" --image "$MASTER" \
        --aspect_ratio 3:4 --wait --wait-timeout 10m 2>&1 | tail -3)
  url=$(echo "$raw" | grep -oE 'https://\S+\.(png|jpg)' | head -1)

  if [ -n "$url" ]; then
    echo "$deg $url" >> "$LOG"          # record before touching disk
    curl -sL -o "$out" "$url"
    echo "OK   $deg"
  else
    echo "FAIL $deg :: $raw"
  fi
}

gen 045 "turned halfway between facing the camera and facing left, a front three-quarter view where we see the front of the jacket and one side of it receding"
gen 135 "turned halfway between facing left and facing away, a rear three-quarter view where we see mostly his back and one shoulder"
gen 225 "turned halfway between facing away and facing right, a rear three-quarter view from the opposite side where we see mostly his back and the other shoulder"
gen 315 "turned halfway between facing right and facing the camera, a front three-quarter view from the opposite side where we see the front of the jacket and the other side receding"

echo "--- balance ---"
"$HF" account status 2>&1 | tail -1
