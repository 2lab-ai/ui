"""Frames of a real video for the stage (the room behind the streamer, a b-roll cutaway): stage.js shows frame n of
<cache>/video/<name>/f_%05d.jpg and waits for it to decode before the screenshot, so the render stays frame-exact.
usage: python video_frames.py <clip.mp4> <name> [--start s] [--secs s] [--fps 30] [--loop 1.0] [--w 1920 --h 1080] [--grade night]
  --loop d : the last d seconds are dissolved into the first ones, so the frames loop without a jump (a room behind her)
  --grade  : a light colour grade (night = a touch darker and cooler, so the room sits behind the avatar)
-> <cache>/video/<name>/f_00001.jpg … + meta.json {"n", "fps", "w", "h", "src"}"""
import json, os, subprocess, sys, tempfile
import numpy as np
from PIL import Image, ImageEnhance

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import themes as TH


def main():
    a = sys.argv[1:]; clip, name = a[0], a[1]
    opt = lambda k, d: type(d)(a[a.index(k) + 1]) if k in a else d
    start, secs, fps, loop = opt('--start', 0.0), opt('--secs', 60.0), opt('--fps', 30), opt('--loop', 0.0)
    W, H, grade = opt('--w', 1920), opt('--h', 1080), opt('--grade', '')
    out = os.path.join(TH.CACHE, 'video', name); os.makedirs(out, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(start), '-t', str(secs), '-i', clip, '-vf',
                        f'fps={fps},scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}', '-q:v', '2', os.path.join(tmp, 'f_%05d.jpg')], check=True)
        fs = sorted(f for f in os.listdir(tmp) if f.endswith('.jpg')); n = len(fs)
        d = int(loop * fps)
        keep = n - d if d else n
        for i in range(keep):
            im = Image.open(os.path.join(tmp, fs[i])).convert('RGB')
            if d and i < d:   # dissolve the tail into the head: frame keep-1 flows into frame 0 again
                a_ = (i + 1) / (d + 1)
                tail = Image.open(os.path.join(tmp, fs[keep + i])).convert('RGB')
                im = Image.blend(tail, im, a_)
            if grade == 'night':
                im = ImageEnhance.Brightness(im).enhance(0.86)
                arr = np.asarray(im).astype(np.float32); arr[..., 2] *= 1.04; arr[..., 0] *= 0.97
                im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
            im.save(os.path.join(out, f'f_{i + 1:05d}.jpg'), quality=86)
        for f in os.listdir(out):
            if f.startswith('f_') and int(f[2:7]) > keep: os.remove(os.path.join(out, f))
    json.dump({'n': keep, 'fps': fps, 'w': W, 'h': H, 'src': os.path.basename(clip), 'loop': loop}, open(os.path.join(out, 'meta.json'), 'w'))
    print(name, keep, 'frames', f'{keep / fps:.1f}s', out)


if __name__ == '__main__':
    main()
