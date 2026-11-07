#!/usr/bin/env bash
# Mistura narração (ElevenLabs) + música de fundo + efeitos sonoros num único áudio.
# Uso: mix.sh narr.mp3 music.mp3 sfx.wav saida.wav
set -euo pipefail
NARR="$1"; MUSIC="$2"; SFX="$3"; OUT="$4"
DUR=$(python3 -c "import sys; sys.path.insert(0,'$(dirname "$0")'); from timeline import video_len; print(round(video_len(),2))")
FADE=$(python3 -c "print(round($DUR-4,2))")
ffmpeg -v error -y -i "$NARR" -i "$MUSIC" -i "$MUSIC" -i "$SFX" -filter_complex "
[0:a]loudnorm=I=-16:TP=-1.5:LRA=7,aformat=sample_rates=48000:channel_layouts=stereo,adelay=1500|1500,apad=whole_dur=$DUR[n];
[1:a]aformat=sample_rates=48000:channel_layouts=stereo[m1];
[2:a]aformat=sample_rates=48000:channel_layouts=stereo[m2];
[m1][m2]acrossfade=d=3[m0];
[m0]atrim=0:$DUR,asetpts=PTS-STARTPTS,volume=-13dB,afade=t=in:d=2,afade=t=out:st=$FADE:d=4[m];
[n]asplit=2[n1][n2];
[m][n1]sidechaincompress=threshold=0.02:ratio=9:attack=25:release=500:makeup=1[md];
[3:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=-7dB[s];
[md][n2][s]amix=inputs=3:normalize=0:duration=longest,atrim=0:$DUR,alimiter=limit=0.95[out]" -map "[out]" -ar 48000 -ac 2 "$OUT"
