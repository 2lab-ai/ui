#!/bin/sh
# usage: mux.sh <build dir>
D=$1
ffmpeg -y -loglevel error -i $D/video.mp4 -i $D/mix.wav -map 0:v -map 1:a -c:v copy -af "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 48000 -c:a aac -b:a 192k -shortest -movflags +faststart $D/final.mp4
ffprobe -v error -show_entries format=duration,size -of csv=p=0 $D/final.mp4
