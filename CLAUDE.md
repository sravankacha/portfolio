# sravankacha.com portfolio

The site is a playground and a showcase. Every theme and lab experiment is a public sample of how I think as a product engineer: idea, craft, and polish. Hold new work to that bar.

## Stack
- Next.js 16 App Router with `output: "export"` (fully static), React 19, Tailwind v4, TypeScript.
- Three.js is loaded from a CDN at runtime via dynamic import, not bundled. Reuse that pattern for heavy libraries.
- Node: always `export PATH=/opt/homebrew/bin:$PATH` first (the default node is a broken x86 build).

## Commands
```bash
npm run dev                  # http://localhost:3000
npm run build                # static export to ./out
npm run preview              # serve ./out on :1234
node scripts/screenshot.mjs <url> <out.png> [--width 1440] [--height 900] [--wait 2500]
```
If the dev server serves stale CSS, stop it, `rm -rf .next`, restart.

## Shipping
- Feature branch, then fast-forward merge to `main`. Push to `main` only when asked.
- Push to `main` runs `.github/workflows/deploy.yml`: build, S3 sync, CloudFront invalidation, then Lighthouse CI against production.
- Lighthouse gates (`lighthouserc.json`): accessibility at least 0.9 is a hard error. Performance at least 0.85 is a warning; treat it as a target.
- `npm run lint` has known pre-existing errors in `app/` (React compiler rules) and `archive-content/`. Don't add new ones.

## Architecture
- **Themes:** registry in `app/_variants/themes.ts`. Each theme is a `[data-theme="<id>"]` block of CSS variables in `app/globals.css`. `ThemeInitScript` sets the theme before paint (`?theme=` param, then localStorage, then random). Themes with heavy hero art use a Gate component (see `OrigamiHeroGate.tsx`) that only mounts the canvas when that theme is active.
- **Hero art:** `app/_components/HeroArt.tsx` holds every theme's hero slot; CSS shows the active one. Client pieces gate themselves with `useThemeId()` (reads `<html data-theme>`). Editorial = `GlassBlob` (WebGL glass, CSS blob as fallback). Ocean = a full-screen live sea (`ocean/OceanVoyage`, `FFTOceanCanvas variant="voyage"`, patch tiled at true scale) with a procedural pirate ship (`ocean/ship.ts`). The hero slot is `ocean/ShipHelm`: drag or arrow keys steer heading and distance via shared state in `ocean/helm.ts`; the heading sets the FFT wind.
- **Origami hero:** animals are sculpted from blended ellipsoids and round cones in `app/_components/origami/animals.ts`, then meshed (surface nets, ~15–40k faceted triangles) in a module Web Worker. Transitions crumple into a shared paper ball via morph targets, so animals need no shared topology. Add an animal by writing a sculpt function and an `ANIMALS` entry.
- **Web Workers:** create them with `new Worker(new URL("./x.worker.ts", import.meta.url), { type: "module" })`. Without `type: "module"`, Turbopack copies the raw `.ts` file instead of bundling it.
- **Lab:** each experiment is `app/lab/<slug>/` with `page.tsx` (metadata and canonical) and a client component. Fullscreen labs use `app/lab/_shared/LabChrome.tsx` for the back button and panels. Register every new experiment in the `experiments` list in `app/lab/page.tsx`.

## Showcase bar for new themes and experiments
Before calling a creative exploration done:
1. **Concept:** one sentence on the idea and why it is interesting. It goes in the lab summary or theme tagline.
2. **Craft:** it should feel intentional and specific, not like a template or tutorial output.
3. **Isolation:** a theme touches only its registry entry, its CSS block and its hero subtree. An experiment lives in its own folder. Removing one must not break anything else.
4. **Performance:** heavy code loads lazily and only on the route or theme that needs it. No new layout shift on the home page.
5. **Resilience:** works without WebGL or on low-power devices with a graceful fallback. Respects `prefers-reduced-motion` by pausing or simplifying animation.
6. **Accessibility:** decorative canvases are `aria-hidden`. Interactive controls are keyboard reachable with visible focus.
7. **Mobile:** check at 390px wide as well as 1440px.
8. **Discoverability:** metadata, canonical URL, lab index entry, and a sitemap entry if routes are listed there.
9. **Verified visually:** screenshots at both widths, and for themes, `?theme=<id>` on home and one inner page.

## Known traps
- Tailwind v4 silently drops a whole custom CSS block if a value like a gradient stack spans multiple lines. Keep complex values on one line, then confirm with `getComputedStyle(document.documentElement).getPropertyValue("--background")`.
- Metadata routes (`robots.ts`, `sitemap.ts`) need `export const dynamic = "force-static"` under static export.
- `<html>` needs `suppressHydrationWarning` because the theme script edits it before hydration.
- Three.js: custom geometry must use the attribute name `position`. Rotate the mesh, not the geometry, for animation. Keep framebuffers under 2^25 pixels.
- CloudFront relies on the `spa-uri-rewrite` function to map `/path/` to `/path/index.html`. New routes need no infra change.
- After a Playwright version bump, run `npx playwright install chromium` or the screenshot script fails.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
