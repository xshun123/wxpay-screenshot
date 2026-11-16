from PIL import Image
Image.MAX_IMAGE_PIXELS = None
im = Image.open('ad_trans.gif')
print('n', im.n_frames, 'size', im.size)
for i in range(im.n_frames):
    try:
        im.seek(i)
        print(i, im.size, im.tile[0][1] if im.tile else None)
    except Exception as e:
        print('FAIL', i, type(e).__name__, str(e)[:80])
        break
