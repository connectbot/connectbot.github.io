[![Build status](https://img.shields.io/travis/com/connectbot/connectbot.github.io/develop.svg)](https://travis-ci.com/connectbot/connectbot.github.io)

# ConnectBot home page

Web page for [ConnectBot](https://connectbot.org/), the first open source SSH client on Android.

## For Contributors

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or later
- [pnpm](https://pnpm.io/) 10 or later

### Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/connectbot/connectbot.github.io.git
   cd connectbot.github.io
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```

   The site will be available at http://localhost:3000

## Contributor documentation

- [Terminal keyboard editor](docs/keyboard-editor.md): format compatibility, previews, tests, and community layout contributions.

- [Development](docs/development.md): project structure, Git hooks, LAN access, checks, and deployment.
- [Parameterized commands in MDX](docs/parameterized-commands.md): shared inputs, templates, and validation.
- [Authoring feature guides](docs/guide-authoring.md): scenarios, translations, capture, narration, and publication.
- [Guide capture reference](docs/guides.md): device setup, speech providers, media behavior, and validation.

## Debug passkey relying party

The WebAuthn CI job packages and deploys two separate Cloudflare Pages sites:

- `webauthn` → `connectbot-webauthn` → `webauthn.connectbot.org`
- `webauthn-debug` → `connectbot-webauthn-debug` → `webauthn-debug.connectbot.org`

Before the first debug deployment, create the `connectbot-webauthn-debug` Pages
project with production branch `main` and attach `webauthn-debug.connectbot.org`
as its custom domain in Cloudflare. Allow Cloudflare to provision DNS and HTTPS.
The debug association authorizes only `org.connectbot.debug` signed with the
specific local test certificate checked in `scripts/check-webauthn.py`;
production remains restricted to the official release identities.

Validate with `python3 scripts/check-webauthn.py`. Package either site with
`python3 scripts/prepare-webauthn.py webauthn` or
`python3 scripts/prepare-webauthn.py webauthn-debug`. A push to `develop` deploys
both. Debug credentials cannot authenticate as release credentials because their
relying-party IDs differ.

### Passkey provider acceptance

The public setup instructions are in
[src/content/guides/ssh-keys.mdx](src/content/guides/ssh-keys.mdx). The exact debug
certificate association is maintained in
[webauthn-debug/.well-known/assetlinks.json](webauthn-debug/.well-known/assetlinks.json).
Serve it over HTTPS with HTTP 200, `application/json`, and no redirects.

On an authorized Android 14+ build, enable Bitwarden as a credential provider,
create an SSH passkey, copy its public key to an OpenSSH server, select the key,
and authenticate. Repeat after restarting ConnectBot. Check cancellation, locked
vault, missing credential, and authentication failure. Record Android, Bitwarden,
and OpenSSH versions and capture the creation and key-list UI.

Test the Google flavor on Android 9–13 with Google Password Manager separately.
An incompatible signed `clientDataJSON` must produce an authentication error;
never rewrite it. Mocked assertions alone do not establish provider
interoperability.
