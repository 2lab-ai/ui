#!/bin/bash
# usage: fetchjob.sh <job_id> <local_dir> — copy a soma-voice job's per-turn wavs (+ status.json) from blade-4090 WSL.
JOB=$1; DST=$2; mkdir -p "$DST"
S=$(mktemp /tmp/fj.XXXX); mv "$S" "$S.sh"; S="$S.sh"
printf 'mkdir -p /mnt/c/Users/zhugehyuk/explainer_tts/%s && cp /opt/soma-voice/main/jobs/%s/chunks/*.wav /opt/soma-voice/main/jobs/%s/status.json /mnt/c/Users/zhugehyuk/explainer_tts/%s/\n' "$JOB" "$JOB" "$JOB" "$JOB" > "$S"
"$(dirname "$0")/wslrun.sh" "$S" >/dev/null 2>&1
scp -q -o BatchMode=yes "${BLADE_SSH:-blade-4090-ps}:C:/Users/zhugehyuk/explainer_tts/$JOB/*" "$DST/"
ssh -o BatchMode=yes "${BLADE_SSH:-blade-4090-ps}" "Remove-Item -Recurse -Force C:\\Users\\zhugehyuk\\explainer_tts\\$JOB, C:\\Users\\zhugehyuk\\$(basename "$S") -ErrorAction SilentlyContinue" >/dev/null 2>&1
rm -f "$S"
