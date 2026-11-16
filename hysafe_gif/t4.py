from PIL import Image
import json, os, itertools
Image.MAX_IMAGE_PIXELS = None

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

def test(name, **kw):
    p=f't_{name}.gif'
    seq[0].save(p, save_all=True, append_images=seq[1:], duration=83, loop=0, **kw)
    try:
        im=Image.open(p); n=im.n_frames
        for i in range(n):
            im.seek(i); im.size
        print('OK  ', name, 'frames', n, os.path.getsize(p)//1024, 'KB')
    except Exception as e:
        print('FAIL', name, str(e)[:50])

test('a', transparency=255, disposal=2)
test('b', transparency=255, disposal=1)
test('c', transparency=255, disposal=2, optimize=True)
test('d', transparency=255)
test('e', transparency=255, disposal=2, include_color_table=True)
test('f', transparency=255, disposal=2, optimize=False)
