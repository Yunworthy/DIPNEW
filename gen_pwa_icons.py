# -*- coding: utf-8 -*-
"""生成 PWA 应用图标（与 favicon 设计一致：靛蓝圆角方块 + 白色 DIP 字标）"""
from PIL import Image, ImageDraw, ImageFont
import os

OUT_DIR = os.path.join('public', 'icons')
os.makedirs(OUT_DIR, exist_ok=True)

INDIGO = (79, 70, 229, 255)      # #4f46e5
INDIGO_DARK = (67, 56, 202, 255) # #4338ca
WHITE = (255, 255, 255, 255)


def make_icon(size):
    # 高分辨率绘制后缩放，保证圆角与文字边缘平滑
    scale = 8
    S = size * scale
    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 圆角方块背景（圆角半径约为边长的 22%）
    radius = int(S * 0.22)
    # 轻微纵向渐变增加质感（保持克制）
    for y in range(S):
        t = y / S
        r = int(INDIGO[0] * (1 - t) + INDIGO_DARK[0] * t)
        g = int(INDIGO[1] * (1 - t) + INDIGO_DARK[1] * t)
        b = int(INDIGO[2] * (1 - t) + INDIGO_DARK[2] * t)
        d.line([(0, y), (S, y)], fill=(r, g, b, 255))

    # 应用圆角遮罩
    mask = Image.new('L', (S, S), 0)
    md = ImageDraw.Draw(mask)
    md.rounded_rectangle([0, 0, S, S], radius=radius, fill=255)
    img.putalpha(mask)

    # 绘制 "DIP" 字标
    font = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', int(S * 0.42))
    text = 'DIP'
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (S - tw) / 2 - bbox[0]
    y = (S - th) / 2 - bbox[1] - int(S * 0.02)
    d.text((x, y), text, font=font, fill=WHITE)

    # 底部点缀：三个像素点（呼应"数字图像"像素概念）
    dot = int(S * 0.045)
    gap = int(S * 0.09)
    cy = int(S * 0.82)
    cx = S // 2
    for i, alpha in enumerate([120, 200, 255]):
        px = cx + (i - 1) * gap
        d.rounded_rectangle([px - dot // 2, cy - dot // 2, px + dot // 2, cy + dot // 2],
                            radius=dot // 3, fill=(255, 255, 255, alpha))

    return img.resize((size, size), Image.LANCZOS)


for size in (512, 192, 180):
    name = 'icon-%dx%d.png' % (size, size)
    make_icon(size).save(os.path.join(OUT_DIR, name), 'PNG')
    print('generated', name)

# maskable 图标（留安全边距，背景铺满）
def make_maskable(size):
    scale = 8
    S = size * scale
    img = Image.new('RGBA', (S, S), INDIGO)
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(r'C:\Windows\Fonts\arialbd.ttf', int(S * 0.34))
    text = 'DIP'
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    d.text(((S - tw) / 2 - bbox[0], (S - th) / 2 - bbox[1]), text, font=font, fill=WHITE)
    return img.resize((size, size), Image.LANCZOS)

make_maskable(512).save(os.path.join(OUT_DIR, 'icon-maskable-512.png'), 'PNG')
print('generated icon-maskable-512.png')
print('done')
