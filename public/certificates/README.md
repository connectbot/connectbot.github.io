# ConnectBot public verification certificates

These files contain public X.509 certificates, not private signing keys.

| File | Purpose | SHA-256 certificate fingerprint |
| --- | --- | --- |
| `connectbot-transparency.pem` | Verify code transparency for Google and OSS releases | `909e650add6ddce32b2307d5aa141f8cdb1bdf455d89388b2f53f8c30fdb0c61` |
| `connectbot-app-signing-2026.pem` | 2026 RSA 4096 app-signing certificate for Google Play and GitHub APKs on Android 13 (API 33) and newer | `d24913b692db31a929cd30ae8618df97718882b6eaa1ed6e124bc43d028e7fbe` |
| `connectbot-app-signing-original.pem` | Original app-signing certificate for both channels on API 32 and earlier, and older releases | `aa43746a46127842169f8176412a1f4b1b1e2f8ad9e15aba217c3822dbeb2d5f` |
| `connectbot-play-app-signing-intermediate.pem` | Intermediate Google Play app-signing certificate for API 33+ before the 2026 rotation, including version code 11101000 | `2fef9cfe29bee1932061a81bfbb8b57c5c658854b82cc97bbf265265ddb2277c` |

Follow [Verify your ConnectBot installation](https://connectbot.org/guides/verify-installation/)
for the user-facing instructions.

API 32 and earlier have always used the original certificate, identical for both
channels. On API 33+, Google Play also used an intermediate signing certificate
before the 2026 RSA 4096 rotation, including version code 11101000. Use
`connectbot-play-app-signing-intermediate.pem` for those installations.

`connectbot-play-app-signing.pem` and `connectbot-github-apk-signing.pem` remain
available as aliases of `connectbot-app-signing-original.pem`.
