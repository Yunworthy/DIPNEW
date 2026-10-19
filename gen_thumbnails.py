# Generate knowledge-point-name thumbnails for all videos
# Replaces video frame screenshots with clean text-based covers
import json
import os
import re
from PIL import Image, ImageDraw, ImageFont

W, H = 480, 270
OUT_DIR = os.path.join('D:', os.sep, 'platform', 'uploads', 'thumbnails')
JSON_PATH = os.path.join('D:', os.sep, 'platform', 'video_kp_map.json')
FONT_PATH = 'C:/Windows/Fonts/msyh.ttc'
FONT_BOLD_PATH = 'C:/Windows/Fonts/msyhbd.ttc'

# Colors
BG_TOP = (30, 41, 59)       # slate-800
BG_BOT = (15, 23, 42)       # slate-900
TEXT_COLOR = (255, 255, 255)
ACCENT = (99, 102, 241)     # indigo-500
SUB_COLOR = (148, 163, 184) # slate-400
PLAY_COLOR = (255, 255, 255, 180)

def gradient_bg(draw):
    """Draw vertical gradient from BG_TOP to BG_BOT."""
    for y in range(H):
        r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * y / H)
        g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * y / H)
        b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * y / H)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

def draw_play_icon(img, cx, cy, size=28):
    """Draw a subtle play triangle icon."""
    overlay = Image.new('RGBA', img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    # Triangle points
    x1, y1 = cx - size // 2, cy - size
    x2, y2 = cx - size // 2, cy + size
    x3, y3 = cx + size, cy
    d.polygon([(x1, y1), (x2, y2), (x3, y3)], fill=PLAY_COLOR)
    img.paste(Image.alpha_composite(Image.new('RGBA', img.size, (0,0,0,0)), overlay), (0, 0), overlay)

def clean_title(title):
    """Clean raw video filename into display-friendly title.
    E.g. '视频_第6章6.1_图像的退化模型' -> '图像的退化模型'
    """
    if not title:
        return title
    # Match: 视频_第X章[section.number]_[actual_title]
    m = re.match(r'^视频_第\d+章[\d.a-z]+_(.+)$', title)
    if m:
        return m.group(1)
    return title

def smart_wrap(text, font, max_width, draw):
    """Smart wrap: keep parenthetical/bracketed groups together, then char-by-char."""
    if not text:
        return ['']

    # Check if entire text fits on one line
    bbox = draw.textbbox((0, 0), text, font=font)
    if bbox[2] - bbox[0] <= max_width:
        return [text]

    # Split into segments: plain text and parenthetical groups
    import re
    segments = re.findall(r'(\([^)]*\)|\[[^\]]*\]|[^(\[]+)', text)

    # Try wrapping by segments (keep each segment intact if possible)
    lines = []
    current = ''
    for seg in segments:
        test = current + seg
        bbox = draw.textbbox((0, 0), test, font=font)
        if bbox[2] - bbox[0] > max_width:
            if current:
                lines.append(current)
                current = seg
            else:
                # Single segment is too long, fall back to char-by-char
                for ch in seg:
                    test2 = current + ch
                    bbox2 = draw.textbbox((0, 0), test2, font=font)
                    if bbox2[2] - bbox2[0] > max_width:
                        if current:
                            lines.append(current)
                        current = ch
                    else:
                        current = test2
        else:
            current = test
    if current:
        lines.append(current)
    return lines

def generate_thumbnail(video):
    """Generate a thumbnail for one video."""
    vid_id = video['id']
    kp_title = video.get('kp_title') or ''
    chapter_title = video.get('chapter_title') or ''
    res_title = clean_title(video.get('title') or '')

    # Priority: KP title > cleaned resource title > chapter title
    main_text = kp_title if kp_title else (res_title if res_title else chapter_title)
    # Skip chapter label if it would duplicate the main text
    show_chapter = chapter_title and (main_text != chapter_title)

    # Create RGBA image for gradient + overlay compositing
    img = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    draw = ImageDraw.Draw(img)

    # Gradient background
    gradient_bg(draw)

    # Accent line at top
    draw.rectangle([(0, 0), (W, 3)], fill=ACCENT)

    # Load fonts
    try:
        font_main = ImageFont.truetype(FONT_BOLD_PATH, 28)
        font_sub = ImageFont.truetype(FONT_PATH, 14)
    except Exception:
        font_main = ImageFont.truetype(FONT_PATH, 28)
        font_sub = ImageFont.truetype(FONT_PATH, 14)

    # Chapter label (top-left) - only if not duplicating main text
    if show_chapter:
        draw.text((20, 14), chapter_title, font=font_sub, fill=SUB_COLOR)

    # Main text - centered, with smart wrapping
    max_w = W - 60
    lines = smart_wrap(main_text, font_main, max_w, draw)

    # Calculate total text block height
    line_heights = []
    line_widths = []
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font_main)
        line_widths.append(bbox[2] - bbox[0])
        line_heights.append(bbox[3] - bbox[1])

    total_h = sum(line_heights) + (len(lines) - 1) * 8
    start_y = (H - total_h) // 2 + (8 if show_chapter else 0)

    for i, line in enumerate(lines):
        lw = line_widths[i]
        lh = line_heights[i]
        x = (W - lw) // 2
        y = start_y
        draw.text((x, y), line, font=font_main, fill=TEXT_COLOR)
        start_y += lh + 8

    # Subtle play icon bottom-right
    draw_play_icon(img, W - 50, H - 45, size=16)

    # Convert to RGB and save
    rgb = img.convert('RGB')
    out_path = os.path.join(OUT_DIR, f'{vid_id}.jpg')
    rgb.save(out_path, 'JPEG', quality=90)
    return out_path

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    with open(JSON_PATH, 'r', encoding='utf-8') as f:
        videos = json.load(f)

    print(f'Generating thumbnails for {len(videos)} videos...')
    for v in videos:
        path = generate_thumbnail(v)
        label = v.get('kp_title') or v.get('chapter_title') or v.get('title', '')
        print(f'  [{v["id"]}] {label} -> {path}')

    print('Done!')

if __name__ == '__main__':
    main()
