from PIL import Image
import json, os

d='frames_trans'
meta=json.load(open(os.path.join(d,'meta.json')))
frames=meta['frames']
imgs=[Image.open(os.path.join(d,f['file'])).convert('RGBA') for f in frames[:4]]
print('src', [i.size for i in imgs])

# 简单方案：整张透明 PNG 直接合成到纯色底后再抠？先测试 P 帧写法
pal_src = imgs[0].convert('RGB').quantize(colors=255)
table = pal_src.getpalette()[:765] + [0,0,0]

seq=[]
for im in imgs:
    alpha=im.getchannel('A').point(lambda a:255 if a>110 else 0)
    p=im.convert('RGB').quantize(palette=pal_src, dither=Image.NONE)
    data=bytearray(p.tobytes()); a=alpha.tobytes()
    for i,av in enumerate(a):
        if av==0: data[i]=255
    q=Image.frombytes('P', im.size, bytes(data))
    q.putpalette(table)
    print('frame', q.size, q.mode, len(q.getpalette()), q.info)
    seq.append(q)

seq[0].save('t1.gif', save_all=True, append_images=seq[1:], duration=80, loop=0, transparency=255, disposal=2)
im2=Image.open('t1.gif'); print('t1 frames', im2.n_frames, im2.size)
for i in range(im2.n_frames):
    im2.seek(i); print(' ok', i, im2.size)
