import sys, json, os
from PIL import Image
d = sys.argv[1]
meta = json.load(open(os.path.join(d,'meta.json')))
fs = meta['frames']
picks = [0, 6, 12, 20, 26, 34, 44, len(fs)-1]
picks = [p for p in picks if 0 <= p < len(fs)]
cols = 4
tw, th = 480, 300
rows = (len(picks)+cols-1)//cols
sheet = Image.new('RGB', (cols*tw, rows*th), 'white')
for i,p in enumerate(picks):
    im = Image.open(os.path.join(d, fs[p]['file'])).convert('RGB').resize((tw,th), Image.LANCZOS)
    sheet.paste(im, ((i%cols)*tw, (i//cols)*th))
out = sys.argv[2]
sheet.save(out)
print('frames', len(fs), 'dts', [f['dt'] for f in fs][:20], 'avg', sum(f['dt'] for f in fs)/len(fs))
print('sheet', out)
