#!/bin/bash
# usage: fetchjob.sh <job_id> <local_dir> — copy a soma-voice job's per-turn wavs (+ status.json) from blade-4090 WSL.
# The job id goes into a remote shell, so only a UUID is accepted.
set -euo pipefail
JOB=$1; DST=$2; host="${BLADE_SSH:-blade-4090-ps}"
[[ "$JOB" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]] || { echo "fetchjob: bad job id: $JOB" >&2; exit 2; }
mkdir -p "$DST"
S="$(mktemp -d)/fj_${JOB}.sh"
cleanup() {
  rm -rf "$(dirname "$S")"
  ssh -o BatchMode=yes "$host" "Remove-Item -Recurse -Force C:\\Users\\zhugehyuk\\explainer_tts\\$JOB, C:\\Users\\zhugehyuk\\fj_$JOB.sh -ErrorAction SilentlyContinue" >/dev/null 2>&1 || true
}
trap cleanup EXIT
printf 'set -e\nmkdir -p /mnt/c/Users/zhugehyuk/explainer_tts/%s\ncp /opt/soma-voice/main/jobs/%s/chunks/*.wav /opt/soma-voice/main/jobs/%s/status.json /mnt/c/Users/zhugehyuk/explainer_tts/%s/\n' "$JOB" "$JOB" "$JOB" "$JOB" > "$S"
"$(dirname "$0")/wslrun.sh" "$S"
scp -q -o BatchMode=yes "$host:C:/Users/zhugehyuk/explainer_tts/$JOB/*" "$DST/"
ls "$DST"/*.wav >/dev/null
