"""Package the static RP site with canonical shared brand assets."""
from pathlib import Path
import shutil
import sys

root = Path(__file__).resolve().parents[1]
site = sys.argv[1] if len(sys.argv) > 1 else 'webauthn'
if site not in ('webauthn', 'webauthn-debug'):
    raise SystemExit('Unknown WebAuthn site')
out = root / 'local' / site
if out.exists():
    shutil.rmtree(out)
shutil.copytree(root / site, out)
for asset in ('brand.css', 'logo.png', 'fonts/logo-font.woff2'):
    target = out / asset
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(root / 'public' / asset, target)
print(f'Prepared {out}')
