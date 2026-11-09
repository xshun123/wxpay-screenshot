import sys
from PIL import Image
im = Image.open(sys.argv[1])
print('size', im.size, 'frames', im.n_frames, 'dur', im.info.get('duration'), 'loop', im.info.get('loop'))
picks = [int(x) for x in sys.argv[3].split(',')]
outs = []
for p in picks:
    im.seek(min(p, im.n_frames-1))
    outs.append(im.convert('RGB').copy())
w, h = outs[0].size
sheet = Image.new('RGB', (w*len(outs), h))
for i, o in enumerate(outs): sheet.paste(o, (i*w, 0))
sheet.save(sys.argv[2])
print('sheet', sys.argv[2], sheet.size)
