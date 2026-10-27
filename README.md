# shadcn-apple-maps-address-autocomplete · shadcn registry

Address autocomplete for the [Apple Maps Server API](https://developer.apple.com/documentation/applemapsserverapi), with a static demo at https://iloveitaly.github.io/shadcn-apple-maps-address-autocomplete/.

The preview replays captured Apple Maps responses. Live search needs a Maps access token from `GET /v1/token`, minted on your server. That token is not a MapKit JS JWT, and the private key stays off the browser.

```tsx
import { AppleMapsAutocomplete } from "@/components/apple-maps-autocomplete"

;<AppleMapsAutocomplete
  accessToken={accessToken}
  onAddressSelect={(address, countryCode) => {
    // `address.structuredAddress` is filled in from the completion request.
  }}
/>
```

`accessToken` can be a string or `() => Promise<string>` when the token needs a refresh. Pass `client` to call your own proxy instead. Autocomplete suggestions omit `structuredAddress`; selecting one follows `completionUrl`.

## Develop

Copier has installed the tools and dependencies and built the registry and demo. Start the demo:

```sh
mise exec -- pnpm dev
```

For a fresh clone, or to repeat installation:

```sh
mise trust mise.toml
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm dev
```

`pnpm build` validates the registry, rebuilds `public/r`, typechecks, and builds the site in `dist`.
`pnpm preview` serves the production build locally, including its configured subpath.

## Author components

Add source files under `registry/new-york/blocks/` and define their files, npm dependencies,
and shadcn dependencies in `registry.json`. Shared UI primitives live in `components/ui/`.
Add a default-exported preview to `app/examples/<registry-item-name>.tsx`; the gallery reads
its title, description, and source link from the registry manifest.

Keep distributed components independent of demo files. Use `registry:component` for portable
components; only use `registry:page` with a framework-specific target intentionally.

```sh
pnpm registry:validate
pnpm check
pnpm build
pnpm exec playwright install chromium
pnpm test
pnpm test:registry
```

## Install

```sh
pnpm dlx shadcn@latest add https://iloveitaly.github.io/shadcn-apple-maps-address-autocomplete/r/apple-maps-autocomplete.json
```

You can also install from the public GitHub repository using `owner/repo/item` addresses.
See [GitHub registries](https://ui.shadcn.com/docs/registry/github).

## Deploy

Enable **Settings → Pages → Source → GitHub Actions** and push to `main` or `master`.
The workflow uses GitHub's built-in token and the Pages URL, including custom domains.
For other hosts, deploy `dist` and set `VITE_SITE_URL` to the public URL before building.
Optional environment overrides are documented in `.env.example`.

## Update

`pnpm upgrade:packages` previews dependency updates. `pnpm upgrade:shadcn` displays upstream
diffs for installed UI components; review and merge the changes you need.
React and React DOM must be updated together. TypeScript remains on 6 until the ESLint parser
supports 7. Review `pnpm audit` findings against actual browser and build-tool usage.

To update the template, commit your changes, then run `bash .copier/update.sh`.
Copier preserves registry sources, examples, your gallery, and HTML during updates.
Inspect the resulting diff and run the checks before committing. Repository: https://github.com/iloveitaly/shadcn-apple-maps-address-autocomplete.
