import json, os, sys
from PIL import Image
d = 'frames_ad'
meta = json.load(open(os.path.join(d,'meta.json')))
fs = meta['frames']
picks = [0, 10, 22, 34, 46, 58, 70, 82, 96, 112, 130, 148]
tw = 300; th = 300; cols = 4
rows = (len(picks)+cols-1)//cols
sheet = Image.new('RGB', (cols*tw, rows*th), 'white')
for i,p in enumerate(picks):
    im = Image.open(os.path.join(d, fs[min(p, len(fs)-1)]['file'])).convert('RGB').resize((tw,th), Image.LANCZOS)
    sheet.paste(im, ((i%cols)*tw, (i//cols)*th))
sheet.save('sheet_ad.png')
print('ok', len(fs), 'dur', sum(f['dt'] for f in fs)/1000, 's')
