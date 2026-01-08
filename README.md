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

### Development Workflow

The site is built with [Next.js](https://nextjs.org/) and [Nextra](https://nextra.site/), a documentation framework. Content is written in MDX (Markdown + JSX) in the `src/content/` directory.

**Project structure:**
- `src/content/` - MDX content files
- `src/content/_meta.ts` - Page configuration (titles, navigation)
- `src/app/` - Next.js App Router structure
- `src/components/` - React components
- `public/` - Static assets

**Git hooks:**
This project uses [Lefthook](https://github.com/evilmartians/lefthook) for Git hooks:
- Pre-commit: Runs ESLint auto-fix and TypeScript type checking
- Commit-msg: Validates conventional commit format

### Building and Testing

**Build the site:**
```bash
pnpm build
```

This generates a static export in the `./out` directory.

**Lint your code:**
```bash
pnpm lint          # Check for errors
pnpm lint:fix      # Auto-fix errors
```

**Type check:**
```bash
pnpm run check:types
```

**Check for unused dependencies:**
```bash
pnpm run check:deps
```

**Analyze bundle size:**
```bash
pnpm run analyze
```

### Deployment

The site is automatically deployed to GitHub Pages when changes are pushed to the `develop` branch. The CI workflow:
1. Runs linting and type checking
2. Builds the static site
3. Deploys to GitHub Pages

You can preview the production build locally by serving the `./out` directory:
```bash
npx serve ./out
```
