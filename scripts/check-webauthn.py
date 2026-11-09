"""Validate the separate release and debug WebAuthn RP identities."""
import hashlib
import json
from pathlib import Path
import ssl

ROOT = Path(__file__).resolve().parents[1]
CERTIFICATES = (
    'connectbot-app-signing-original.pem',
    'connectbot-play-app-signing-intermediate.pem',
    'connectbot-app-signing-2026.pem',
)
fingerprints = []
for certificate in CERTIFICATES:
    pem = (ROOT / 'public/certificates' / certificate).read_text()
    digest = hashlib.sha256(ssl.PEM_cert_to_DER_cert(pem)).hexdigest().upper()
    fingerprints.append(':'.join(digest[i:i + 2] for i in range(0, 64, 2)))
expected = [{
    'relation': ['delegate_permission/common.get_login_creds'],
    'target': {
        'namespace': 'android_app',
        'package_name': 'org.connectbot',
        'sha256_cert_fingerprints': fingerprints,
    },
}]
actual = json.loads((ROOT / 'webauthn/.well-known/assetlinks.json').read_text())
if actual != expected:
    raise SystemExit('WebAuthn association must match the three official release certificates')
debug = json.loads((ROOT / 'webauthn-debug/.well-known/assetlinks.json').read_text())
expected_debug = [{
    'relation': ['delegate_permission/common.get_login_creds'],
    'target': {
        'namespace': 'android_app',
        'package_name': 'org.connectbot.debug',
        'sha256_cert_fingerprints': [
            'C1:8F:63:40:06:F9:B6:68:EF:7C:5C:EB:3E:DB:50:D0:90:E7:DC:C0:23:DD:A7:2A:6A:08:D9:3D:F3:2F:35:C2',
        ],
    },
}]
if debug != expected_debug:
    raise SystemExit('Debug association must match the authorized local debug certificate')
print('Release and debug WebAuthn associations match their separate identities')
