from PIL import Image
import json, os

d='frames_trans'
meta=json.load(open(os.path.join(d,'meta.json')))
frames=meta['frames']
imgs=[Image.open(os.path.join(d,f['file'])).convert('RGBA') for f in frames]

pal_src = imgs[10].convert('RGB').quantize(colors=255)
table = pal_src.getpalette()[:765] + [0,0,0]
seq=[]
for im in imgs:
    alpha=im.getchannel('A').point(lambda a:255 if a>110 else 0)
    p=im.convert('RGB').quantize(palette=pal_src, dither=Image.NONE)
    data=bytearray(p.tobytes()); a=alpha.tobytes()
    for i,av in enumerate(a):
        if av==0: data[i]=255
    q=Image.frombytes('P', im.size, bytes(data)); q.putpalette(table)
    seq.append(q)

seq[0].save('t2.gif', save_all=True, append_images=seq[1:], duration=80, loop=0, transparency=255, disposal=2, optimize=False)
im=Image.open('t2.gif'); print('n_frames', im.n_frames)
bad=[]
for i in range(im.n_frames):
    try:
        im.seek(i); _=im.size
    except Exception as e:
        bad.append((i, str(e)[:60]))
print('bad', bad[:5], 'count', len(bad))
