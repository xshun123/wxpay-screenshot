import subprocess, os
import imageio_ffmpeg
from PIL import Image
FF = imageio_ffmpeg.get_ffmpeg_exe()

def ff(args):
    return subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error'] + args, capture_output=True, text=True)

# 1) 时长/编码信息
for f in ['ad_alpha.mp4', 'ad_alpha.webm', 'ad_alpha.mov']:
    p = subprocess.run([FF, '-hide_banner', '-i', f], capture_output=True, text=True)
    line = [l for l in p.stderr.splitlines() if 'Duration' in l or 'Stream' in l]
    print(f, '=>', ' | '.join(x.strip()[:110] for x in line[:2]))

# 2) 抽帧看画面
ff(['-i', 'ad_alpha.mp4', '-vf', 'select=eq(n\,20)', '-frames:v', '1', 'v_mp4.png'])
ff(['-c:v', 'libvpx-vp9', '-i', 'ad_alpha.webm', '-vf', 'select=eq(n\,60)', '-frames:v', '1', '-pix_fmt', 'rgba', 'v_webm.png'])
a = Image.open('v_mp4.png').convert('RGB')
b = Image.open('v_webm.png').convert('RGBA')
print('mp4 frame', a.size, 'webm frame', b.size, 'webm has alpha:', b.getchannel('A').getextrema())
# 合成到深色底看 webm 透明
bg = Image.new('RGBA', b.size, (18, 22, 36, 255)); bg.alpha_composite(b)
bg.convert('RGB').save('v_webm_on_dark.png')
a.save('v_mp4_view.png')
print('done')
