/// <reference types="vite/client" />
// for typescript to avoid throwing errors relating to vite env variables

interface ImportMetaEnv {
  readonly VITE_GITHUB_BRANCH: string
  readonly VITE_GITHUB_REPO_URL: string
  readonly VITE_SITE_URL: string
  readonly VITE_BASE_PATH?: string
  readonly VITE_GITHUB_PAGES_URL?: string
  /** Maps Server API access token from GET /v1/token. Not a MapKit JS JWT. */
  readonly VITE_APPLE_MAPS_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
