/**
 * Browser client for the Apple Maps Server API.
 *
 * `accessToken` is the short-lived token from `GET /v1/token`, minted on your
 * server with the Maps private key. It is not a MapKit JS JWT.
 *
 * https://developer.apple.com/documentation/applemapsserverapi
 */

const APPLE_MAPS_ORIGIN = "https://maps-api.apple.com"

export interface Location {
  latitude: number
  longitude: number
}

export interface StructuredAddress {
  administrativeArea?: string | null
  administrativeAreaCode?: string | null
  subAdministrativeArea?: string | null
  areasOfInterest?: string[] | null
  dependentLocalities?: string[] | null
  fullThoroughfare?: string | null
  locality?: string | null
  postCode?: string | null
  subLocality?: string | null
  subThoroughfare?: string | null
  thoroughfare?: string | null
}

/**
 * One suggestion from `/v1/searchAutocomplete`.
 * `structuredAddress` is usually empty until `complete` follows `completionUrl`.
 */
export interface AutocompleteResult {
  completionUrl?: string | null
  displayLines?: string[] | null
  location?: Location | null
  structuredAddress?: StructuredAddress | null
}

/** A place from `/v1/search` or `/v1/reverseGeocode`. */
export interface Place {
  id?: string | null
  name?: string | null
  coordinate?: Location | null
  formattedAddressLines?: string[] | null
  structuredAddress?: StructuredAddress | null
  country?: string | null
  countryCode?: string | null
}

export interface AppleMapsClient {
  autocomplete(query: string): Promise<AutocompleteResult[]>
  complete(completionUrl: string): Promise<Place | null>
  reverseGeocode(latitude: number, longitude: number): Promise<Place | null>
}

export type AppleMapsAccessToken = string | (() => string | Promise<string>)

export interface AppleMapsClientOptions {
  accessToken: AppleMapsAccessToken
  /** ISO 3166-1 alpha-2 codes, comma-separated. Defaults to US. */
  limitToCountries?: string
  /** BCP 47 language tag. Defaults to en-US. */
  lang?: string
  /** Result types sent as `resultTypeFilter`. Defaults to addresses and POIs. */
  resultTypeFilter?: string
  fetch?: typeof fetch
}

async function resolveAccessToken(
  source: AppleMapsAccessToken,
): Promise<string> {
  const token = typeof source === "function" ? await source() : source
  if (!token) {
    throw new Error("Apple Maps access token is empty.")
  }
  return token
}

async function appleGet(
  path: string,
  params: Record<string, string | undefined>,
  token: string,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  const url = new URL(path, APPLE_MAPS_ORIGIN)
  if (url.origin !== APPLE_MAPS_ORIGIN) {
    throw new Error("Unexpected Apple Maps URL.")
  }
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }

  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(`Apple Maps request failed (${response.status}).`)
  }
  return response.json()
}

export function createAppleMapsClient({
  accessToken,
  limitToCountries = "US",
  lang = "en-US",
  resultTypeFilter = "address,poi",
  fetch: fetchImpl = fetch,
}: AppleMapsClientOptions): AppleMapsClient {
  return {
    async autocomplete(query) {
      const token = await resolveAccessToken(accessToken)
      const data = (await appleGet(
        "/v1/searchAutocomplete",
        {
          q: query,
          limitToCountries,
          lang,
          resultTypeFilter,
        },
        token,
        fetchImpl,
      )) as { results?: AutocompleteResult[] }
      return data.results ?? []
    },

    async complete(completionUrl) {
      const token = await resolveAccessToken(accessToken)
      const url = new URL(completionUrl, APPLE_MAPS_ORIGIN)
      if (url.origin !== APPLE_MAPS_ORIGIN) {
        throw new Error("Unexpected Apple Maps completion URL.")
      }
      const params = Object.fromEntries(url.searchParams.entries())
      params.lang = lang
      const data = (await appleGet(url.pathname, params, token, fetchImpl)) as {
        results?: Place[]
      }
      return data.results?.[0] ?? null
    },

    async reverseGeocode(latitude, longitude) {
      const token = await resolveAccessToken(accessToken)
      const data = (await appleGet(
        "/v1/reverseGeocode",
        { loc: `${latitude},${longitude}`, lang },
        token,
        fetchImpl,
      )) as { results?: Place[] }
      return data.results?.[0] ?? null
    },
  }
}
