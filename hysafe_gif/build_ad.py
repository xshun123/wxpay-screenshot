import json, os, sys
from PIL import Image

frames_dir = 'frames_ad'
meta = json.load(open(os.path.join(frames_dir, 'meta.json')))
frames = meta['frames']
out_path = sys.argv[1] if len(sys.argv) > 1 else 'ad.gif'
size = int(sys.argv[2]) if len(sys.argv) > 2 else 1080

imgs = []
for f in frames:
    im = Image.open(os.path.join(frames_dir, f['file'])).convert('RGB')
    if size != im.width:
        im = im.resize((size, size), Image.LANCZOS)
    imgs.append(im)

# global palette from spread of frames
step = max(1, len(imgs) // 8)
samples = imgs[::step][:8]
strip = Image.new('RGB', (imgs[0].width, imgs[0].height * len(samples)))
for i, s in enumerate(samples):
    strip.paste(s, (0, i * imgs[0].height))
pal = strip.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE)

seq = [im.quantize(palette=pal, dither=Image.NONE) for im in imgs]
dur = 1000 // meta['fps']
durs = [dur] * len(seq)
seq[0].save(out_path, save_all=True, append_images=seq[1:], duration=durs, loop=0,
            optimize=True, disposal=1, interlace=False)
print(out_path, 'frames', len(seq), 'size', f"{os.path.getsize(out_path)/1024/1024:.2f} MB", 'dur', sum(durs)/1000, 's')
