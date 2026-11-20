#!/usr/bin/env bash
# Trims the raw recording to the scripted 0:00–1:07 and encodes a web-friendly MP4 plus captions.
set -euo pipefail
cd "$(dirname "$0")/out"

offset=$(node -p "require('./timing.json').offset")
duration=$(node -p "require('./timing.json').duration")

# 30fps H.264, fast-start for web playback; 1s fade-out at the end.
ffmpeg -loglevel error -y -ss "$offset" -i raw.webm -t "$duration" \
  -vf "fps=30,fade=t=out:st=$(node -p "$duration-0.8"):d=0.8,format=yuv420p" \
  -c:v libx264 -preset slow -crf 27 -movflags +faststart -an snip-demo.mp4

# Captions as SRT so the voiceover can be recorded against them (or uploaded as subtitles).
node -e '
const { captions } = require("./timing.json");
const ts = (s) => { const ms = Math.round(s * 1000); const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };
const vo = [[60.2, 66.6, "Snip runs entirely in your browser. Nothing gets uploaded. Try it with your own statement, link below."]];
const all = [...captions, ...vo];
require("fs").writeFileSync("snip-demo.srt", all.map(([s, e, t], i) => `${i + 1}\n${ts(s)} --> ${ts(e)}\n${t}\n`).join("\n"));
'
ls -lh snip-demo.mp4 snip-demo.srt
