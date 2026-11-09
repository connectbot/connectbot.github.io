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
- `webauthn-debug` → `connectbot-webauthn-debug` → `debug.webauthn.connectbot.org`

Before the first debug deployment, create the `connectbot-webauthn-debug` Pages
project with production branch `main` and attach `debug.webauthn.connectbot.org`
as its custom domain in Cloudflare. Allow Cloudflare to provision DNS and HTTPS.
The debug association authorizes only `org.connectbot.debug` signed with the
specific local test certificate checked in `scripts/check-webauthn.py`;
production remains restricted to the official release identities.

Validate with `python3 scripts/check-webauthn.py`. Package either site with
`python3 scripts/prepare-webauthn.py webauthn` or
`python3 scripts/prepare-webauthn.py webauthn-debug`. A push to `develop` deploys
both. Debug credentials cannot authenticate as release credentials because their
relying-party IDs differ.
