from pathlib import Path
from PIL import Image

root = Path('/home/ubuntu/Navixa-v1/public')
configs = {
    'navixa-logo-clean.png': (720, 614),
    'navixa-mark.png': (384, 347),
}
for name, size in configs.items():
    path = root / name
    image = Image.open(path).convert('RGBA')
    image.thumbnail(size, Image.Resampling.LANCZOS)
    image.save(path, format='PNG', optimize=True, compress_level=9)
    print(f'{name}: {image.size} / {path.stat().st_size} bytes')
