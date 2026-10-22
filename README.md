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
