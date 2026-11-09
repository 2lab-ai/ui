#!/bin/bash
# usage: wslrun.sh <script-file> — copy a bash script to blade-4090 (Windows) and run it inside WSL Ubuntu.
# PowerShell mangles `wsl -- bash -c "..."` quoting, so the script travels as a file.
name=$(basename "$1")
scp -q -o BatchMode=yes "$1" "${BLADE_SSH:-blade-4090-ps}:C:/Users/zhugehyuk/$name" || exit 1
timeout "${T:-120}" ssh -o BatchMode=yes "${BLADE_SSH:-blade-4090-ps}" "wsl -d Ubuntu -e bash /mnt/c/Users/zhugehyuk/$name"
