"""Package the static RP site with canonical shared brand assets."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
out = root / 'local/webauthn'
if out.exists():
    shutil.rmtree(out)
shutil.copytree(root / 'webauthn', out)
for asset in ('brand.css', 'logo.png', 'fonts/logo-font.woff2'):
    target = out / asset
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / 'public' / asset, target)
print(f'Prepared {out}')
