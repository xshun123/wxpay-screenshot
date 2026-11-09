import sys
from PIL import Image
for p in sys.argv[1:]:
    im = Image.open(p)
    tot = 0
    durs = []
    for i in range(im.n_frames):
        im.seek(i)
        d = im.info.get('duration', 0)
        durs.append(d); tot += d
    print(f'{p}: frames={im.n_frames} total={tot}ms ({tot/1000:.2f}s) size={im.size} uniq={len(set(durs))}')
    print('  durs[:15]', durs[:15])
