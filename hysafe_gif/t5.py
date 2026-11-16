from PIL import Image
Image.MAX_IMAGE_PIXELS = None
im = Image.open('ad_trans.gif')
for idx in (0, 12, 20):
    im.seek(idx)
    f = im.convert('RGBA')
    bg = Image.new('RGB', (720, 720), (16, 20, 32)).convert('RGBA')
    bg.alpha_composite(f)
    bg.convert('RGB').save(f'frame_gif_{idx}.png')
    print(idx, 'saved')
src = Image.open('frames_trans/f0000.png').convert('RGBA')
bg = Image.new('RGB', (720, 720), (16, 20, 32)).convert('RGBA')
bg.alpha_composite(src)
bg.convert('RGB').save('frame_src_0.png')
print('src saved')
