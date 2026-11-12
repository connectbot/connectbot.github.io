# Development

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

## Dependency compatibility

Use Node.js 26 and the pnpm version pinned in `package.json`. pnpm 12 reads
dependency build permissions from `allowBuilds` in `pnpm-workspace.yaml`.
The trust policy remains enabled; its Lefthook exception covers only 2.2.2,
whose npm release lacks provenance.

ESLint 10 uses `eslint-plugin-jsx-a11y-x` for accessibility checks.
`pnpm check:types` runs TypeScript 7's `tsc` through the `@typescript/native`
package alias. The `typescript` alias supplies `@typescript/typescript6` for
typescript-eslint, Next.js, and Nextra's Twoslash dependencies, which still
need the JavaScript compiler API. Its separate executable is `tsc6`.
This follows [Microsoft's side-by-side setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0).

CI uses Ubuntu 24.04, which the pinned Playwright release supports.

The pnpm patch for `nextra-theme-docs@4.6.1` includes `children` when validating
layout props, fixing [Nextra's incompatibility with Zod 4.4 and later](https://github.com/shuding/nextra/issues/5008).
Remove the patch once an upstream Nextra release includes the fix.

## LAN access

To open the dev server through a LAN address, set
`NEXT_ALLOWED_DEV_ORIGINS=192.168.1.10` in `.env.local`, using your server's
IP or hostname, then restart `pnpm dev`. Separate multiple hosts with commas.

## Building and testing

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

## Deployment

The site is automatically deployed to Cloudflare Pages when changes are pushed to the `develop` branch. The CI workflow:
1. Runs linting and type checking
2. Builds the static site
3. Deploys to Cloudflare Pages

You can preview the production build locally by serving the `./out` directory:
```bash
npx serve ./out
```

See [WebAuthn hosting](webauthn.md) for the independent passkey association deployment.
