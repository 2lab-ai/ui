#!/bin/bash
# usage: wslrun.sh <script-file> — copy a bash script to blade-4090 (Windows) and run it inside WSL Ubuntu.
# PowerShell mangles `wsl -- bash -c "..."` quoting, so the script travels as a file. T=<seconds> caps the run.
set -euo pipefail
host="${BLADE_SSH:-blade-4090-ps}"
name=$(basename "$1")
[[ "$name" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "wslrun: bad script name: $name" >&2; exit 2; }
scp -q -o BatchMode=yes "$1" "$host:C:/Users/zhugehyuk/$name"
cap=$(command -v timeout || command -v gtimeout || true)   # coreutils timeout is optional on macOS
${cap:+$cap "${T:-120}"} ssh -o BatchMode=yes "$host" "wsl -d Ubuntu -e bash /mnt/c/Users/zhugehyuk/$name"
