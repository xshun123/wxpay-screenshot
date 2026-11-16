b = open('ad_trans.gif','rb').read()
print('len', len(b), b[:6], 'LSD', b[6:13].hex())
i = 13 + 768
n = 0
while i < len(b) and n < 6:
    tag = b[i]
    if tag == 0x21:
        label = b[i+1]
        j = i + 2
        blocks = []
        while j < len(b) and b[j] != 0:
            blocks.append(b[j]); j += b[j] + 1
        print(n, 'ext', hex(label), 'at', i, 'blocklens', blocks[:6], 'total blocks', len(blocks))
        i = j + 1
    elif tag == 0x2C:
        left, top, w, h = int.from_bytes(b[i+1:i+3],'little'), int.from_bytes(b[i+3:i+5],'little'), int.from_bytes(b[i+5:i+7],'little'), int.from_bytes(b[i+7:i+9],'little')
        packed = b[i+9]
        print(n, 'img at', i, 'left,top,w,h', left, top, w, h, 'packed', hex(packed))
        j = i + 10
        mcs = b[j]; j += 1
        start = j
        while b[j] != 0: j += b[j] + 1
        print('   mcs', mcs, 'data bytes', j - start)
        i = j + 1
    else:
        print('unknown tag', hex(tag), 'at', i); break
    n += 1
