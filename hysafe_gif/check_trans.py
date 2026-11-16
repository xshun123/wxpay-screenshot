from PIL import Image
Image.MAX_IMAGE_PIXELS = None
im = Image.open('ad_trans.gif')
tot = 0
durs = []
for i in range(im.n_frames):
    im.seek(i)
    d = im.info.get('duration', 0); durs.append(d); tot += d
print('frames', im.n_frames, 'total', tot, 'ms', 'durs', durs[:12])
picks = [0, 2, 5, 8, 11, 14, 16]
W = 720
sheet_dark = Image.new('RGB', (W * 4, W * 2), (16, 20, 32))
sheet_light = Image.new('RGB', (W * 4, W * 2), (238, 242, 250))
for i, p in enumerate(picks):
    im.seek(min(p, im.n_frames - 1))
    f = im.convert('RGBA')
    x, y = (i % 4) * W, (i // 4) * W
    for sheet in (sheet_dark, sheet_light):
        base = sheet.crop((x, y, x + W, y + W)).convert('RGBA')
        base.alpha_composite(f)
        sheet.paste(base.convert('RGB'), (x, y))
combo = Image.new('RGB', (W * 4, W * 4 + 20), 'white')
combo.paste(sheet_dark, (0, 0))
combo.paste(sheet_light, (0, W * 2 + 20))
combo = combo.resize((1440, 1455), Image.LANCZOS)
combo.save('check_trans.png')
print('ok')
