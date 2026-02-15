# Phase 1A — Project Scaffolding

## Goal

Initialize a working pnpm monorepo with all packages, TypeScript configs, tooling, and directory structure so that `pnpm install` succeeds and TypeScript compilation passes.

## Prerequisites

- None (first segment)
- Node.js 20+ installed
- pnpm 9+ installed

## Dependency Graph Position

```
► Phase 1A ──► Phase 1B ──► Phase 1C ──► Phase 1D ──► ...
```

---

## Implementation Spec

### 1. Root Files

**`pnpm-workspace.yaml`**
```yaml
packages:
  - "packages/*"
  - "apps/*"
```

**`package.json`** (root)
```json
{
  "name": "formant",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "vitest",
    "test:e2e": "pnpm --filter e2e test",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write ."
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "prettier": "^3"
  }
}
```

**`tsconfig.base.json`**
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "moduleResolution": "bundler",
    "module": "ESNext",
    "target": "ES2022",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "jsx": "react-jsx",
    "noEmit": true
  },
  "exclude": ["node_modules", "dist"]
}
```

**`vitest.config.ts`** (root — workspace config)
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    workspace: [
      "packages/core",
      "packages/renderer",
      "packages/html-builder"
      // Note: packages/service uses @cloudflare/vitest-pool-workers, configured separately
    ],
  },
});
```

**`.eslintrc.json`**
```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "warn"
  },
  "ignorePatterns": ["dist/", "node_modules/", "*.js"]
}
```

Add ESLint dev deps to root: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-config-prettier`.

**`.prettierrc`**
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

**`README.md`**
Create a skeleton README with:
- Project name and one-line description: "Self-contained form generation and hosting. Forms are single HTML files that work anywhere."
- Tech stack bullet list
- Getting started: `pnpm install && pnpm dev`
- Project structure overview (the directory tree from plan.md)
- License reference

**`LICENSE`**

MIT License. Full permissive — use, modify, profit freely. Standard MIT text with current year and project name "Formant".

### 2. Package: `@formant/core`

**`packages/core/package.json`**
```json
{
  "name": "@formant/core",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

**`packages/core/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

Create placeholder files:
- `packages/core/src/types.ts` — `export {};`
- `packages/core/src/validate.ts` — `export {};`
- `packages/core/src/engine.ts` — `export {};`
- `packages/core/src/index.ts` — `export {};`
- `packages/core/__tests__/validate.test.ts` — `import { describe, it } from "vitest";`
- `packages/core/__tests__/engine.test.ts` — `import { describe, it } from "vitest";`

### 3. Package: `@formant/renderer`

**`packages/renderer/package.json`**
```json
{
  "name": "@formant/renderer",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.tsx",
  "types": "./src/index.tsx",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@formant/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "happy-dom": "latest"
  }
}
```

**`packages/renderer/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "jsx": "react-jsx"
  },
  "include": ["src/**/*"]
}
```

**`packages/renderer/vitest.config.ts`**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "happy-dom",
  },
});
```

Create placeholder files for the full directory structure:
- `packages/renderer/src/Formant.tsx`
- `packages/renderer/src/index.tsx`
- `packages/renderer/src/styles.ts`
- `packages/renderer/src/questions/Welcome.tsx`
- `packages/renderer/src/questions/TextInput.tsx`
- `packages/renderer/src/questions/NumberInput.tsx`
- `packages/renderer/src/questions/Choice.tsx`
- `packages/renderer/src/questions/MultiChoice.tsx`
- `packages/renderer/src/questions/Rating.tsx`
- `packages/renderer/src/questions/Scale.tsx`
- `packages/renderer/src/questions/YesNo.tsx`
- `packages/renderer/src/questions/TextArea.tsx`
- `packages/renderer/src/questions/DateInput.tsx`
- `packages/renderer/src/questions/Dropdown.tsx`
- `packages/renderer/src/questions/Statement.tsx`
- `packages/renderer/src/questions/Ending.tsx`
- `packages/renderer/src/questions/index.ts`
- `packages/renderer/src/components/ProgressBar.tsx`
- `packages/renderer/src/components/KeyboardHint.tsx`
- `packages/renderer/src/components/ThemeToggle.tsx`
- `packages/renderer/src/components/TransitionWrapper.tsx`
- `packages/renderer/src/components/ErrorMessage.tsx`
- `packages/renderer/src/hooks/useFormEngine.ts`
- `packages/renderer/src/hooks/useKeyboard.ts`
- `packages/renderer/src/hooks/useTheme.ts`
- `packages/renderer/src/submit/handler.ts`
- `packages/renderer/src/submit/sheets.ts`
- `packages/renderer/src/submit/webhook.ts`
- `packages/renderer/src/submit/service.ts`
- `packages/renderer/src/submit/excel.ts`
- `packages/renderer/__tests__/Formant.test.tsx`
- `packages/renderer/__tests__/submit.test.ts`

All placeholder files: `export {};`

### 4. Package: `@formant/html-builder`

**`packages/html-builder/package.json`**
```json
{
  "name": "@formant/html-builder",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "@formant/core": "workspace:*",
    "esbuild": "latest"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3"
  }
}
```

**`packages/html-builder/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

Create placeholder files:
- `packages/html-builder/src/build.ts`
- `packages/html-builder/src/template.ts`
- `packages/html-builder/src/cli.ts` — `// TODO: Future phase — CLI entry point (formant build schema.json -o form.html)`
- `packages/html-builder/src/index.ts`
- `packages/html-builder/__tests__/build.test.ts`

### 5. Package: `@formant/service`

**`packages/service/package.json`**
```json
{
  "name": "@formant/service",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "db:migrate": "wrangler d1 execute formant-db --file=src/db/schema.sql"
  },
  "dependencies": {
    "@formant/core": "workspace:*",
    "hono": "latest",
    "nanoid": "latest"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3",
    "wrangler": "latest",
    "@cloudflare/vitest-pool-workers": "latest",
    "@cloudflare/workers-types": "latest"
  }
}
```

**`packages/service/tsconfig.json`**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*"]
}
```

**`packages/service/wrangler.toml`**
```toml
name = "formant"
main = "src/index.ts"
compatibility_date = "2024-12-01"

[[d1_databases]]
binding = "DB"
database_name = "formant-db"
database_id = ""
```

Create placeholder files:
- `packages/service/src/index.ts`
- `packages/service/src/routes/forms.ts`
- `packages/service/src/routes/responses.ts`
- `packages/service/src/routes/export.ts`
- `packages/service/src/db/schema.sql`
- `packages/service/src/db/queries.ts`
- `packages/service/src/middleware/cors.ts`
- `packages/service/src/middleware/auth.ts`
- `packages/service/src/utils/id.ts`
- `packages/service/src/utils/xlsx.ts`
- `packages/service/__tests__/forms.test.ts`
- `packages/service/__tests__/responses.test.ts`

### 6. App: E2E Tests

**`apps/e2e/package.json`**
```json
{
  "name": "e2e",
  "private": true,
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui"
  },
  "devDependencies": {
    "@playwright/test": "latest",
    "@formant/html-builder": "workspace:*",
    "@formant/core": "workspace:*"
  }
}
```

**`apps/e2e/playwright.config.ts`** — basic config (details in Phase 1G plan)

Create placeholder files:
- `apps/e2e/tests/formant.spec.ts`
- `apps/e2e/tests/branching.spec.ts`
- `apps/e2e/tests/keyboard.spec.ts`
- `apps/e2e/tests/validation.spec.ts`
- `apps/e2e/tests/submit.spec.ts`
- `apps/e2e/tests/theme.spec.ts`
- `apps/e2e/fixtures/simple-form.json`
- `apps/e2e/fixtures/branching-form.json`
- `apps/e2e/fixtures/full-form.json`

### 7. Skill Directory

Create placeholder:
- `skill/SKILL.md` — `<!-- Formant skill — to be implemented in Phase 1-Skill -->`
- `skill/examples/` — empty directory (create `.gitkeep`)

### 8. Scripts Directory

Create placeholder:
- `scripts/apps-script/sheets-connector.gs` — `// To be implemented in Phase 2`
- `scripts/setup.sh` — basic `#!/bin/bash` header with `pnpm install` + `pnpm build`

---

## Files to Create

All files listed above. Total: ~60+ files including all placeholders, configs, and package.json files.

## Completion Criteria

Run these commands and verify:

```bash
# 1. Install succeeds
pnpm install

# 2. TypeScript passes across all packages
pnpm -r exec tsc --noEmit

# 3. Directory structure matches plan
find packages apps skill scripts -type f | head -80

# 4. Workspace references resolve
pnpm ls -r --depth 0

# 5. Vitest can be invoked (even if no tests yet)
pnpm test -- --run 2>&1 | grep -v "no test"
```

## Open Questions

None — all decisions resolved for this segment.
