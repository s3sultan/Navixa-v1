#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VID="$ROOT/public/video"
AUD="$VID/audio"
OUT="$VID/final/navixa-overview-v3.mp4"
TMP="$ROOT/.tmp-navixa-v3"
mkdir -p "$TMP" "$(dirname "$OUT")"

# Brand intro uses the same real scene and lower-third language as the ending.
# NAVIXA and the smaller SA suffix are separated; no standalone card is placed over the footage.
ffmpeg -y -stream_loop -1 -i "$VID/navixa-overview-06-cta-clean.mp4" -i "$AUD/navixa-v3-intro.wav" \
  -filter_complex "[0:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,setsar=1,fps=30,drawbox=x=0:y=586:w=1280:h=134:color=0x102f43@0.74:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='NAVIXA':fontcolor=white:fontsize=52:x=(w-text_w)/2-18:y=610,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='SA':fontcolor=0xd9d3ee:fontsize=22:x=(w-text_w)/2+115:y=602,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='مساعدك الذكي، حاضر في التفاصيل التي تهمك':fontcolor=0xf7f4ef:fontsize=26:x=(w-text_w)/2:y=665[v]" \
  -map "[v]" -map 1:a -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 160k -t 7 -movflags +faststart "$TMP/00-intro.mp4" >/dev/null 2>&1

make_scene(){
  local video="$1" audio="$2" output="$3" text="${4:-}"
  local vf="scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=0xf7f4ef,fps=30,setsar=1"
  if [[ -n "$text" ]]; then
    vf+=",drawbox=x=0:y=586:w=1280:h=134:color=0x102f43@0.74:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text=${text}:fontcolor=white:fontsize=44:x=(w-text_w)/2:y=625"
  fi
  ffmpeg -y -stream_loop -1 -i "$video" -i "$audio" -filter_complex "[0:v]${vf}[v]" -map "[v]" -map 1:a -c:v libx264 -pix_fmt yuv420p -c:a aac -b:a 160k -shortest -movflags +faststart "$output" >/dev/null 2>&1
}

make_scene "$VID/navixa-sync-01-name-to-phone.mp4" "$AUD/navixa-sync-final-01.wav" "$TMP/01.mp4"
make_scene "$VID/navixa-sync-02-screen-to-phone.mp4" "$AUD/navixa-sync-final-02.wav" "$TMP/02.mp4"
make_scene "$VID/navixa-sync-03-academic-capture.mp4" "$AUD/navixa-sync-final-03.wav" "$TMP/03.mp4"
make_scene "$VID/navixa-overview-04-meeting-summary.mp4" "$AUD/navixa-sync-final-summary.wav" "$TMP/04.mp4"
make_scene "$VID/navixa-overview-05-daily-life.mp4" "$AUD/navixa-v3-secondary.wav" "$TMP/05.mp4"
make_scene "$VID/navixa-overview-06-cta-clean.mp4" "$AUD/navixa-sync-final-04-sa.wav" "$TMP/06.mp4" "navixasa.com"

ffmpeg -y -i "$TMP/00-intro.mp4" -i "$TMP/01.mp4" -i "$TMP/02.mp4" -i "$TMP/03.mp4" -i "$TMP/04.mp4" -i "$TMP/05.mp4" -i "$TMP/06.mp4" -stream_loop -1 -i "$AUD/navixa-overview-bgm.wav" \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a][3:v][3:a][4:v][4:a][5:v][5:a][6:v][6:a]concat=n=7:v=1:a=1[v][voice];[7:a]volume=0.11[bg];[voice][bg]amix=inputs=2:duration=first:weights='1 0.18'[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -pix_fmt yuv420p -preset medium -crf 21 -c:a aac -b:a 192k -movflags +faststart "$OUT"
echo "$OUT"
