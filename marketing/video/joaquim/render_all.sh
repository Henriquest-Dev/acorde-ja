#!/usr/bin/env bash
# Renderiza todas as cenas (retoma onde parou). Uso: render_all.sh <pasta_de_saida>
cd "$(dirname "$0")"
OUT="$1"
for s in s8_hoje s1_escuro s6_virada s3_apostas s5_perda s4_bar s2b_olhos s7b_respirar s7a_escudo s7c_dias s2a_ecra; do
  FRAME_STEP=2 python3 render.py $s "$OUT/$s" 20 540 960 2>&1 | grep -E "SHOT_DONE|Error|Traceback" 
done
echo ALL_DONE
