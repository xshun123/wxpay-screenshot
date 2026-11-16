import subprocess, sys, os, glob
import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
D = 'frames_vid'
FPS = 30
SIZE = 1080
n = len(glob.glob(os.path.join(D, 'f*.png')))
print('frames on disk', n)

def run(args):
    p = subprocess.run([FF, '-y', '-hide_banner', '-loglevel', 'error'] + args, capture_output=True, text=True)
    if p.returncode != 0:
        print('FAIL', args[-1]); print(p.stderr[-1500:]); sys.exit(1)
    print('ok', args[-1], f"{os.path.getsize(args[-1])/1024/1024:.2f} MB")

src = ['-framerate', str(FPS), '-i', os.path.join(D, 'f%04d.png')]

# 1) MP4：黑底不透明，通用 / OBS 里用「滤色/加亮」叠加也能去黑
run(src + ['-f', 'lavfi', '-i', f'color=c=black:s={SIZE}x{SIZE}:r={FPS}:d=4',
           '-filter_complex', '[1:v][0:v]overlay=format=auto:shortest=1,format=yuv420p',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high',
           '-movflags', '+faststart', 'ad_alpha.mp4'])

# 2) WebM：VP9 + Alpha 真透明
run(src + ['-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '26',
           '-row-mt', '1', '-cpu-used', '2', 'ad_alpha.webm'])

# 3) MOV：ProRes 4444 + Alpha，剪辑软件用
run(src + ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le',
           '-vendor', 'apl0', 'ad_alpha.mov'])

# 4) MP4 竖屏/横屏不做了，再出一个静态封面
run(['-i', os.path.join(D, 'f0010.png'), '-frames:v', '1', 'ad_poster.png'])
