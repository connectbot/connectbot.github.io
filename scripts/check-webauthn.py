"""Validate the release identities published by the WebAuthn RP domain."""
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
print('WebAuthn association matches all three official release certificates')
