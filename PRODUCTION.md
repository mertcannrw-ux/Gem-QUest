# Gem Quest Production Readiness

## Automated gates

Run:

```bash
npm ci
npm run verify
```

The gate covers:

- JavaScript syntax for all runtime files
- missing local assets, script references, and CSS resource URLs
- unsafe dynamic execution and HTML injection patterns
- obsolete CrazyGames SDK URLs/APIs
- repository size and file-count limits
- item reward correctness and stack caps
- flat vs percentage stat calculations
- save/load conflict resolution, timeout handling, and late cloud-write repair
  through the CrazyGames v3 data adapter
- rewarded-ad start/playback lifecycle and error handling
- keyboard/touch input-source isolation and stage-transition freeze behavior
- production-package asset-reference validation after every build
- HTTP security headers, methods, and traversal handling

The same gate runs in `.github/workflows/ci.yml`.

## Manual release checklist

Automated tests cannot prove device-, portal-, or policy-specific behavior.
Before uploading a release:

1. Test the packaged game in the CrazyGames developer preview.
2. Confirm `gameplayStart`, `gameplayStop`, `loadingStart`, and `loadingStop`
   events in the portal tooling.
3. Confirm a real rewarded ad grants a revive only after the full ad finishes,
   and that unfilled/blocked ads grant nothing.
4. Test audio recovery on physical iOS Safari after an interruption.
5. Complete one full run on Chrome, Edge, Safari, Android Chrome, and iOS Safari.
6. Verify persistent coins, unlocked stages, and permanent shop upgrades after
   refresh and on a second logged-in device.
7. Provide the current CrazyGames cover/icon assets and store metadata.
8. Add the publisher's real privacy-policy URL in the portal/store metadata if
   required by the data collected outside the CrazyGames SDK.

## Known operational boundary

`serve.js` is a hardened local preview server, not a general-purpose internet
application server. The shipped game is static and should be served by
CrazyGames or a maintained HTTPS CDN in production.
