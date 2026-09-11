# andrewlandry.com

Andrew Landry's personal website, built with Astro and TypeScript.

The current project contains six independently designed concepts and a comparison
page at `/`. These are design studies, not the final site. Each direction has its
own responsive layout, working photo enlargement, and on-demand music playback.

| Route | Direction |
| --- | --- |
| `/designs/contact-sheet/` | Graphic black, white, and vermilion portfolio |
| `/designs/after-hours/` | Cinematic dark photography and listening room |
| `/designs/field-notes/` | Tactile personal journal and photographic keepsakes |
| `/designs/blue-frequency/` | Cobalt and lemon art-poster composition |
| `/designs/still-life/` | Restrained serif gallery with generous whitespace |
| `/designs/soft-signal/` | Playful modular collection with category filters |

Direction notes are in `docs/design-directions.md`. The six random inspiration
seeds were generated outside the repository and are not included in any page.
Images are web derivatives from Andrew's former portfolio; source URLs are in
`docs/asset-sources.json`. Google Fonts supply display typography, with local
system fallbacks. YouTube loads only after a visitor chooses to play music.

## Development

Use Node.js 24 (`nvm use`) and npm. Commit `package-lock.json` with dependency changes.

```sh
npm ci
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run check` | Check Astro and TypeScript files |
| `npm run build` | Generate the static site in `dist/` |
| `npm run preview` | Preview the production build locally |

## Architecture

- Astro generates static pages; TypeScript uses strict checking.
- Content will live in the repository, using Content Collections when needed.
- Styling will use custom CSS. Interactive components can be added as needed.
- No CMS or database is configured.
- A private Sites deployment is used to compare the design studies.
- Cloudflare Workers Static Assets remains the planned host for the final site.

## GitHub checks and reviews

- **CI** runs `npm ci`, `npm run check`, and `npm run build` on pushes to `main`
  and on pull requests.
- **Claude Code Review** automatically reviews non-draft pull requests from this
  repository when opened, updated, reopened, or marked ready for review. It posts
  findings as a PR comment. Manual workflow runs review the latest commit and
  report in the Actions log, which also provides a way to verify authentication.
- **Claude PR Follow-up** responds to `@claude` in PR conversation comments from
  the owner, members, and collaborators. Claude is configured for review only.
- **CodeScene** uses its native GitHub pull-request integration. It is configured
  in CodeScene's project settings and reports independently of GitHub Actions.
  The old `empear-analytics/codescene-ci-cd` Actions bridge is deprecated.

Claude uses the installed Claude GitHub App and the repository Actions secret
`CLAUDE_CODE_OAUTH_TOKEN`. The secret must be renewed if it expires. Automatic
Claude reviews intentionally exclude fork PRs because they cannot receive this
secret; a maintainer can request a review through a trusted PR comment.

CodeScene setup requires granting the CodeScene Access GitHub App access to this
repository, creating a CodeScene project for it, running an initial analysis,
and enabling automated PR reviews in that project's settings. Its analysis
coverage depends on supported file types; a successful integration is not a
promise that `.astro` markup is scored.

GitHub Actions are pinned to commit hashes. Update those pins when upgrading an
Action. Never commit credentials, `.env` files, or private media originals.

## Project layout

- `src/pages/`: Astro page routes
- `public/`: assets copied directly to the output
- `.github/workflows/`: CI and Claude review automation
- `AGENTS.md` and `CLAUDE.md`: development and review guidance
