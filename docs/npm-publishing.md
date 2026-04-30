# NPM Publishing Guide for Boomerang Plugin

> **Note**: The Boomerang plugin's JavaScript/TypeScript code is published to NPM as a companion to the main Python package (`opencode-boomerang` on PyPI). This guide covers NPM-specific publishing for the OpenCode plugin component.

---

## 📁 Plugin Structure

The OpenCode plugin lives at `src/opencode_boomerang/assets/.opencode/plugins/boomerang/`:

```
plugins/boomerang/
├── dist/                    # Compiled JavaScript (published to NPM)
│   ├── index.js
│   ├── index.d.ts
│   ├── orchestrator.js
│   ├── agents/
│   │   ├── index.js
│   │   ├── base-agent.js
│   │   ├── coder-agent.js
│   │   ├── architect-agent.js
│   │   └── ...
│   └── ...
├── src/                     # TypeScript source (development only)
├── package.json
└── tsconfig.json
```

The `dist/` folder is what gets published to NPM. The TypeScript source is compiled before publishing.

---

## 📦 package.json Example

```json
{
  "name": "@boomerang/opencode-plugin",
  "version": "0.1.0",
  "description": "Intelligent multi-agent orchestration plugin for OpenCode with Boomerang Protocol",
  "main": "dist/index.js",
  "module": "dist/index.js",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "types": "dist/index.d.ts",
  "files": [
    "dist/"
  ],
  "scripts": {
    "build": "npx tsc",
    "typecheck": "npx tsc --noEmit",
    "prepublishOnly": "npm run typecheck && npm run build"
  },
  "keywords": [
    "opencode",
    "boomerang",
    "multi-agent",
    "orchestration",
    "plugin"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/Veedubin/opencode-boomerang"
  },
  "license": "MIT",
  "peerDependencies": {
    "@opencode-ai/plugin": "^1.4.3",
    "@opencode-ai/sdk": "^1.4.6"
  },
  "dependencies": {
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "^1.4.3",
    "@opencode-ai/sdk": "^1.4.6",
    "@tsconfig/node22": "^22.0.0",
    "@types/node": "^25.6.0",
    "typescript": "^5.7.3"
  }
}
```

### Key Fields Explained

| Field | Purpose |
|-------|---------|
| `name` | Scoped package (`@boomerang/opencode-plugin`) to avoid name collisions |
| `main` | Entry point for CommonJS compatibility |
| `module` | Entry point for ES modules |
| `exports` | Modern package entry point with type safety |
| `files` | Only publish `dist/` — exclude source and build artifacts |
| `peerDependencies` | Required by consumer, not bundled |
| `prepublishOnly` | Runs automatically before `npm publish` |

---

## 🔄 CI/CD Workflow for NPM Publishing

Create `.github/workflows/npm-publish.yml`:

```yaml
name: Publish to NPM

on:
  push:
    tags:
      - 'plugin-v*.*.*'

jobs:
  build-and-publish:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
          scope: '@boomerang'

      - name: Install dependencies
        working-directory: src/opencode_boomerang/assets/.opencode/plugins/boomerang
        run: npm ci

      - name: Typecheck
        working-directory: src/opencode_boomerang/assets/.opencode/plugins/boomerang
        run: npm run typecheck

      - name: Build
        working-directory: src/opencode_boomerang/assets/.opencode/plugins/boomerang
        run: npm run build

      - name: Verify dist contents
        run: |
          echo "Dist contents:"
          ls -la src/opencode_boomerang/assets/.opencode/plugins/boomerang/dist/

      - name: Publish to NPM
        working-directory: src/opencode_boomerang/assets/.opencode/plugins/boomerang
        run: npm publish --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  github-release:
    needs: build-and-publish
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Create Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: ${{ github.ref_name }}
          name: Boomerang Plugin ${{ github.ref_name }}
          body: |
            ## Boomerang OpenCode Plugin ${{ github.ref_name }}

            Published to NPM: https://www.npmjs.com/package/@boomerang/opencode-plugin

            Install via:
            ```bash
            npm install @boomerang/opencode-plugin
            ```
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Required Secrets

Add `NPM_TOKEN` to your GitHub repository secrets:
1. Go to **Settings → Secrets and variables → Actions**
2. Create `NPM_TOKEN` with your NPM access token

Generate an automation token at [npmjs.com/settings/tokens](https://www.npmjs.com/settings/tokens) with "Automation" type.

---

## 📋 Pre-Publish Checklist

Before publishing a new version:

- [ ] **Version bump**: Update `version` in `package.json`
- [ ] **TypeScript compiles**: `npm run typecheck` passes
- [ ] **Build succeeds**: `npm run build` produces `dist/`
- [ ] **Tests pass**: Any existing plugin tests pass
- [ ] **Changelog updated**: Document changes in CHANGELOG.md
- [ ] **NPM account verified**: `npm login` works and token is valid
- [ ] **Package name available**: Verify `@boomerang/opencode-plugin` is available
- [ ] **Peer dependencies correct**: Ensure version ranges match OpenCode's versions
- [ ] **License included**: MIT license is appropriate
- [ ] **Repository URL correct**: Points to your GitHub repo

---

## 🏷️ Version Bumping Strategy

### Semantic Versioning (SemVer)

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Bug fixes, no API changes | `patch` | `0.1.0` → `0.1.1` |
| New features, backward compatible | `minor` | `0.1.0` → `0.2.0` |
| Breaking changes | `major` | `0.1.0` → `1.0.0` |

### Workflow

```bash
# 1. Checkout main and pull latest
git checkout main && git pull

# 2. Create release branch
git checkout -b release/plugin-v0.2.0

# 3. Update version in package.json
# Edit: "version": "0.2.0"

# 4. Commit and tag
git add -A && git commit -m "Bump plugin version to 0.2.0"
git tag plugin-v0.2.0

# 5. Push (triggers GitHub Actions)
git push origin release/plugin-v0.2.0 --tags
```

### Automated Version Bumping

Use `standard-version` or `release-please`:

```bash
# Install
npm install -D standard-version

# Create release
npx standard-version --release-as 0.2.0
```

Or add to `package.json` scripts:

```json
{
  "scripts": {
    "release:major": "standard-version --release-as major",
    "release:minor": "standard-version --release-as minor",
    "release:patch": "standard-version --release-as patch"
  }
}
```

---

## 📐 Semantic Versioning Guidelines

### For the Boomerang Plugin

**Patch version (0.1.0 → 0.1.1)**:
- Bug fixes
- Documentation updates
- Performance improvements without API changes
- Internal refactoring

**Minor version (0.1.0 → 0.2.0)**:
- New agent types added
- New Boomerang Protocol steps
- New configuration options (backward compatible)
- Enhanced quality gates
- New memory integration features

**Major version (0.1.0 → 1.0.0)**:
- Breaking changes to exported API
- Changes to `DEFAULT_CONFIG` structure
- Agent role signature changes
- Removal of deprecated features
- New required peer dependencies

### Pre-1.0 Considerations

Until `1.0.0`, treat the plugin as beta:
- Expect frequent breaking changes
- Use `^` or `~` in peer dependencies conservatively
- Document breaking changes prominently in release notes

---

## 🔧 Troubleshooting

### Name Collision

**Error**: `npm ERR! 403 Forbidden - 407 Conflict - Package name already exists`

**Solution**: Use a scoped package name:
```json
{
  "name": "@boomerang/opencode-plugin"
}
```

Then publish with:
```bash
npm publish --access public
```

### Authentication Errors

**Error**: `npm ERR! ENEEDAUTH` or `npm ERR! 401 Unauthorized`

**Solutions**:
1. Verify token is valid: `npm whoami`
2. Check token has correct permissions (Automation scope)
3. Ensure `NODE_AUTH_TOKEN` secret is set in GitHub Actions
4. Re-login locally: `npm logout && npm login`

### Version Conflicts

**Error**: `npm ERR! 409 Conflict - Cannot publish over existing version`

**Solution**: You must bump the version before publishing:
```bash
# Check current version
npm view @boomerang/opencode-plugin version

# Bump version
npm version patch  # or minor or major

# Publish
npm publish
```

### TypeScript Build Failures

**Error**: `error TS` compilation errors

**Solutions**:
1. Run typecheck before building: `npm run typecheck`
2. Ensure correct TypeScript version: `npm ls typescript`
3. Check `tsconfig.json` is correct
4. Verify `@opencode-ai/plugin` types are compatible

### Missing Dist Files

**Error**: Published package missing `dist/` contents

**Solution**: Ensure `files` array in `package.json` includes `dist/`:
```json
{
  "files": [
    "dist/"
  ]
}
```

Also verify `.npmignore` isn't excluding `dist/`:
```bash
npm pack --dry-run
```

### Peer Dependency Warnings

**Warning**: `npm WARNEB01 peer dependencies unsatisfied`

**Solution**: This is expected — peer dependencies must be installed by the consumer. Document clearly in `README` that users need:
```bash
npm install @opencode-ai/plugin @opencode-ai/sdk
```

### GitHub Actions Token Issues

**Error**: `GITHUB_TOKEN` is not permitted

**Solution**: Ensure workflow has correct permissions:
```yaml
permissions:
  contents: write  # For releases
```

---

## 📚 Additional Resources

- [NPM Publishing Documentation](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages)
- [Semantic Versioning](https://semver.org/)
- [GitHub Actions for NPM](https://docs.github.com/en/actions/publishing-packages/publishing-nodejs-packages)
- [OpenCode Plugin Documentation](https://opencode.ai/docs/plugins)

---

## 🔗 Related Documentation

- [Python Package Publishing](./python-publishing.md) — For the main `opencode-boomerang` PyPI package
- [README.md](../../README.md) — Main project documentation
