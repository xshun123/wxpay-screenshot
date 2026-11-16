import json, os, sys, io, struct
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

d = 'frames_trans'
meta = json.load(open(os.path.join(d, 'meta.json')))
frames = meta['frames']
out = sys.argv[1]
size = int(sys.argv[2]) if len(sys.argv) > 2 else 720
ALPHA_MIN = 110
TRANSPARENT_IDX = 255
DELAY = max(1, round(1000 / meta['fps'] / 10))  # 单位 1/100 秒

imgs = []
for f in frames:
    im = Image.open(os.path.join(d, f['file'])).convert('RGBA')
    if size != im.width:
        im = im.resize((size, size), Image.LANCZOS)
    imgs.append(im)

# —— 选一帧不透明度最高的做取色源（透明区不参与）——
def opaque_score(im):
    a = list(im.getchannel('A').get_flattened_data()) if hasattr(im.getchannel('A'), 'get_flattened_data') else list(im.getchannel('A').getdata())
    return sum(1 for v in a if v > ALPHA_MIN)
best = max(imgs[: max(1, len(imgs)//2)], key=opaque_score)
pal_src = best.convert('RGB').quantize(colors=255, method=Image.MEDIANCUT, dither=Image.NONE)
table = pal_src.getpalette()[:765] + [0, 0, 0]

pal_frames = []
for im in imgs:
    alpha = im.getchannel('A').point(lambda a: 255 if a > ALPHA_MIN else 0)
    p = im.convert('RGB').quantize(palette=pal_src, dither=Image.NONE)
    data = bytearray(p.tobytes())
    a = alpha.tobytes()
    for i, av in enumerate(a):
        if av == 0:
            data[i] = TRANSPARENT_IDX
    q = Image.frombytes('P', im.size, bytes(data))
    q.putpalette(table)
    pal_frames.append(q)

# —— 每帧单独编码成单帧 GIF，取出图像数据块 ——
def frame_data_bytes(img):
    buf = io.BytesIO()
    img.save(buf, format='GIF', transparency=TRANSPARENT_IDX, optimize=False)
    b = buf.getvalue()
    # 跳 header(6) + LSD(7) + GCT
    flags = b[10]
    gct = 3 * (2 ** ((flags & 7) + 1)) if (flags & 0x80) else 0
    i = 13 + gct
    # 跳过扩展块，找到图像描述符 0x2C
    while i < len(b):
        if b[i] == 0x21:  # extension
            i += 2
            while b[i] != 0:
                i += b[i] + 1
            i += 1
        elif b[i] == 0x2C:
            break
        else:
            raise RuntimeError('unexpected block %r at %d' % (b[i], i))
    packed = b[i + 9]
    interlace = packed & 0x40      # 0x40 = 交错标志，必须原样带上
    if packed & 0x80:
        lct = 3 * (2 ** ((packed & 7) + 1))
    else:
        lct = 0
    j = i + 10 + lct
    mcs = b[j]                     # LZW 最小码长
    j += 1
    start = j
    while b[j] != 0:
        j += b[j] + 1
    j += 1
    return mcs, b[start:j], interlace

chunks = [frame_data_bytes(f) for f in pal_frames]
W, H = size, size

outb = bytearray()
outb += b'GIF89a'
outb += struct.pack('<HHBBB', W, H, 0xF7, 0, 0)   # GCT 256 色
outb += bytes(table[:768])
outb += b'\x21\xff\x0bNETSCAPE2.0\x03\x01\x00\x00\x00'   # 无限循环
for mcs, data, interlace in chunks:
    outb += b'\x21\xf9\x04' + struct.pack('<BHB', (2 << 2) | 1, DELAY, TRANSPARENT_IDX) + b'\x00'  # GCE: disposal=2(还原为透明), 透明色
    outb += b'\x2c' + struct.pack('<HHHHB', 0, 0, W, H, interlace)  # 整帧，无局部色板，保留交错位
    outb += bytes([mcs])
    outb += data

open(out, 'wb').write(outb)

im = Image.open(out)
for i in range(im.n_frames):
    im.seek(i); im.size
print(out, 'frames', im.n_frames, 'total', im.n_frames * DELAY * 10, 'ms', 'size', f"{os.path.getsize(out)/1024:.0f} KB")
