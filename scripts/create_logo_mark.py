from PIL import Image
from pathlib import Path

source = Path('/home/ubuntu/Navixa-v1/public/navixa-logo-clean.png')
target = Path('/home/ubuntu/Navixa-v1/public/navixa-mark.png')
image = Image.open(source).convert('RGBA')
# The supplied brand lockup places the emblem above the wordmark.
mark = image.crop((0, 0, image.width, int(image.height * 0.72)))
alpha = mark.getchannel('A')
bbox = alpha.getbbox()
if bbox:
    mark = mark.crop(bbox)
mark.save(target, 'PNG', optimize=True)
print(f'saved {target} {mark.size}')
