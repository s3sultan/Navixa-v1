from PIL import Image
from pathlib import Path

source = Path('/home/ubuntu/Navixa-v1/public/navixa-logo.png')
target = Path('/home/ubuntu/Navixa-v1/public/navixa-logo-clean.png')
image = Image.open(source).convert('RGBA')
pixels = image.load()
for y in range(image.height):
    for x in range(image.width):
        r, g, b, a = pixels[x, y]
        spread = max(r, g, b) - min(r, g, b)
        if spread <= 10 and min(r, g, b) >= 210:
            pixels[x, y] = (r, g, b, 0)
        elif spread <= 18 and min(r, g, b) >= 188:
            alpha = max(0, int((210 - min(r, g, b)) * 3.2))
            pixels[x, y] = (r, g, b, min(a, alpha))
alpha = image.getchannel('A')
bbox = alpha.getbbox()
if bbox:
    image = image.crop(bbox)
image.save(target, 'PNG', optimize=True)
print(f'saved {target} {image.size}')
