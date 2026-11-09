import json, os, sys
from PIL import Image, ImageDraw

SRC_W, SRC_H = 1600, 1000
OUT_W, OUT_H = 1120, 700
S = OUT_W / SRC_W

CURSOR = [(0,0),(0,24),(5.6,18.6),(9.4,27),(13.2,25.2),(9.6,17.4),(16,17.4)]
ACCENT = (79, 109, 245)

def load(d):
    with open(os.path.join(d, 'meta.json')) as f:
        return json.load(f)['frames']

def click_times(frames):
    """Return list of (time_ms, x, y) for each press."""
    out, t = [], 0
    prev = False
    for f in frames:
        if f['cursor']['down'] and not prev:
            out.append((t, f['cursor']['x'], f['cursor']['y']))
        prev = f['cursor']['down']
        t += f['dt']
    return out

def draw_cursor(img, x, y, pressed):
    layer = Image.new('RGBA', img.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    pts = [(sx*S + x, sy*S + y) for sx, sy in CURSOR]
    # shadow
    sh = [(px+1.5, py+2.5) for px, py in pts]
    d.polygon(sh, fill=(15, 23, 42, 70))
    d.polygon(pts, fill=(255,255,255,255), outline=(20, 26, 40, 255), width=2)
    if pressed:
        d.ellipse([x-9, y-9, x+9, y+9], outline=(20, 26, 40, 90), width=2)
    out = Image.alpha_composite(img, layer)
    return out

def draw_ripple(img, cx, cy, p):
    """p in [0,1] expansion progress"""
    layer = Image.new('RGBA', img.size, (0,0,0,0))
    d = ImageDraw.Draw(layer)
    r = 8 + 30 * p
    a = int(150 * (1 - p) ** 1.6)
    if a > 0:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ACCENT + (a,), width=3)
        d.ellipse([cx - r*0.55, cy - r*0.55, cx + r*0.55, cy + r*0.55], outline=ACCENT + (int(a*0.55),), width=2)
    return Image.alpha_composite(img, layer)

def build(frames_dir, out_path, poster_path=None, hold_last_ms=900):
    frames = load(frames_dir)
    clicks = click_times(frames)
    imgs = []
    t = 0
    for f in frames:
        base = Image.open(os.path.join(frames_dir, f['file'])).convert('RGB').resize((OUT_W, OUT_H), Image.LANCZOS).convert('RGBA')
        # ripple
        for ct, cx, cy in clicks:
            if 0 <= t - ct <= 320:
                base = draw_ripple(base, cx*S, cy*S, (t - ct) / 320)
        if f['cursor']['visible']:
            base = draw_cursor(base, f['cursor']['x']*S, f['cursor']['y']*S, f['cursor']['down'])
        imgs.append(base.convert('RGB'))
        t += f['dt']

    # global palette from a few representative frames (avoids palette flicker)
    samples = [imgs[i] for i in range(0, len(imgs), max(1, len(imgs)//6))][:6]
    strip = Image.new('RGB', (OUT_W, OUT_H * len(samples)))
    for i, im in enumerate(samples):
        strip.paste(im, (0, i * OUT_H))
    pal_img = strip.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.NONE)

    pframes = []
    for im in imgs:
        pframes.append(im.quantize(palette=pal_img, dither=Image.NONE))

    durs = [max(40, min(400, f['dt'])) for f in frames]

    # merge consecutive visually-identical frames, then trim the frozen lead-in / tail
    merged_img, merged_dur = [], []
    for im, d in zip(pframes, durs):
        sig = im.convert('L').resize((56, 35), Image.BILINEAR).tobytes()
        if merged_img and merged_img[-1][1] == sig:
            merged_dur[-1] += d
        else:
            merged_img.append((im, sig))
            merged_dur.append(d)
    seq = [im for im, _ in merged_img]
    if merged_dur:
        merged_dur[0] = min(merged_dur[0], 140)   # no frozen lead-in
        merged_dur[-1] = max(merged_dur[-1], hold_last_ms)  # readable ending hold
    seq[0].save(out_path, save_all=True, append_images=seq[1:], duration=merged_dur,
                loop=0, optimize=True, disposal=1, interlace=False)
    print('merged frames:', len(seq), 'total ms:', sum(merged_dur))
    if poster_path:
        imgs[len(imgs)//3].save(poster_path)
    size = os.path.getsize(out_path)
    print(f'{out_path}  frames={len(imgs)}  {size/1024/1024:.2f} MB  clicks={clicks}')

if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
