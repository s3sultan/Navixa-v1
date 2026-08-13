from pathlib import Path

root = Path('/home/ubuntu/Navixa-v1/app')
replacements = {
    '#075e3d': '#087f83',
    '#0b7850': '#10b7b2',
    '#8d78cf': '#7656d6',
    '#9a88db': '#8f76ed',
    '#a997e6': '#b5a6ff',
    '#173d2d': '#123e56',
    '#14231d': '#102f43',
    '#f7f8f5': '#f7fbfc',
    '#faf9f5': '#f7fbfc',
    '#edf6f1': '#e6fbf7',
    '#e7f4ec': '#e6fbf7',
    '#e7f2ea': '#e6fbf7',
    '#dcefe4': '#d3f1ec',
    '#e9f4ed': '#e6fbf7',
    '#e3f2e9': '#e5f7f4',
}
for path in root.rglob('*.css'):
    text = path.read_text()
    updated = text
    for old, new in replacements.items():
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated)
        print(path)
