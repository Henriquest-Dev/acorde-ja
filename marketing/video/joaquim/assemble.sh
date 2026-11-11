#!/usr/bin/env bash
# Monta o filme «Joaquim»: cenas (12 img/s -> 24), logótipo, cor, grão, legendas e som.
# Uso: assemble.sh <pasta_de_trabalho> <musica.mp3> <saida.mp4>
set -euo pipefail
W="$1"; MUSIC="$2"; OUT="$3"
HERE="$(cd "$(dirname "$0")" && pwd)"
FONTS="$HERE/../../../node_modules/@expo-google-fonts/inter/700Bold"
SHOTS="s1_escuro:7.3 s2a_ecra:2.8 s2b_olhos:4.3 s3_apostas:8.2 s4_bar:5.5 s5_perda:6.6 s6_virada:7.2 s7a_escudo:3.1 s7b_respirar:4.4 s7c_dias:3.3 s8_hoje:7.0"
mkdir -p "$W/clips"; : > "$W/clips/list.txt"
for s in $SHOTS; do
  n="${s%%:*}"; d="${s##*:}"
  ffmpeg -v error -y -framerate 12 -pattern_type glob -i "$W/frames/$n/f*.png" -vf "fps=24,scale=1080:1920:flags=lanczos,tpad=stop_mode=clone:stop_duration=1" -t "$d" -c:v libx264 -crf 14 -preset fast -pix_fmt yuv420p "$W/clips/$n.mp4"
  echo "file '$n.mp4'" >> "$W/clips/list.txt"
done
ffmpeg -v error -y -f concat -safe 0 -i "$W/clips/list.txt" -c copy "$W/main.mp4"
ffmpeg -v error -y -framerate 24 -i "$W/logo/l%04d.png" -c:v libx264 -crf 14 -preset fast -pix_fmt yuv420p "$W/logo.mp4"
DUR=63.4 ADEL=1000 bash "$HERE/../mix.sh" "$W/narr_el.mp3" "$MUSIC" "$W/sfx.wav" "$W/audio.wav"
ffmpeg -v error -y -i "$W/main.mp4" -i "$W/logo.mp4" -i "$W/audio.wav" -filter_complex "
[0:v]eq=contrast=1.05:saturation=1.10,vignette=PI/5.5,noise=alls=5:allf=t,fade=t=in:d=0.7[m];
[m][1:v]xfade=transition=fadewhite:duration=0.6:offset=59.1,subtitles='$W/subs.ass':fontsdir='$FONTS',tpad=stop_mode=clone:stop_duration=1[v]" \
  -map "[v]" -map 2:a -t 63.4 -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -r 24 -c:a aac -b:a 192k -movflags +faststart "$OUT"
echo "OK $OUT"
