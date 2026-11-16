import io, struct
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

src = Image.open('frames_trans/f0000.png').convert('RGBA')
pal_src = src.convert('RGB').quantize(colors=255)
table = pal_src.getpalette()[:765] + [0,0,0]
alpha = src.getchannel('A').point(lambda a: 255 if a > 110 else 0)
p = src.convert('RGB').quantize(palette=pal_src, dither=Image.NONE)
data = bytearray(p.tobytes()); a = alpha.tobytes()
for i, av in enumerate(a):
    if av == 0: data[i] = 255
q = Image.frombytes('P', src.size, bytes(data)); q.putpalette(table)

buf = io.BytesIO(); q.save(buf, format='GIF', transparency=255, optimize=False)
b = buf.getvalue()
print('single gif bytes', len(b), 'LSD', b[6:13].hex())
flags = b[10]; gct = 3 * (2 ** ((flags & 7) + 1)) if (flags & 0x80) else 0
print('gct bytes', gct)
i = 13 + gct
while b[i] != 0x2C:
    if b[i] == 0x21:
        i += 2
        while b[i] != 0: i += b[i] + 1
        i += 1
    else:
        print('unexpected', hex(b[i])); break
packed = b[i+9]
lct = 3 * (2 ** ((packed & 7) + 1)) if packed & 0x80 else 0
print('img at', i, 'packed', hex(packed), 'lct', lct)
j = i + 10 + lct
mcs = b[j]; j += 1
start = j
while b[j] != 0: j += b[j] + 1
j += 1

out = bytearray()
out += b'GIF89a' + struct.pack('<HHBBB', 720, 720, 0xF7, 0, 0) + bytes(table)
out += b'\x21\xf9\x04' + struct.pack('<BHB', 9, 8, 255) + b'\x00'
out += b'\x2c' + struct.pack('<HHHHB', 0,0,720,720,0) + bytes([mcs]) + b[start:j]
open('t_single.gif','wb').write(out)

im = Image.open('t_single.gif'); im.seek(0)
im.convert('RGB').save('t_single_decoded.png')
print('decoded ok', im.size)
