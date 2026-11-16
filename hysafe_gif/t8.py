from PIL import Image
Image.MAX_IMAGE_PIXELS = None
im = Image.open('ad_trans.gif')
W=720
sheet = Image.new('RGB', (W*3, W*2), (10, 12, 20))
picks = [5, 10, 16, 26, 33, 45]
for i,p in enumerate(picks):
    im.seek(p)
    f = im.convert('RGBA')
    tile = Image.new('RGB', (W, W), (10,12,20)).convert('RGBA')
    tile.alpha_composite(f)
    sheet.paste(tile.convert('RGB'), ((i%3)*W, (i//3)*W))
sheet = sheet.resize((1080, 720), Image.LANCZOS)
sheet.save('t8.png')
print('ok')
