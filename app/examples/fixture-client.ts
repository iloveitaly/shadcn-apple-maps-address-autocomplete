import fixtures from "@/app/examples/apple-maps-fixtures.json"
import type {
  AppleMapsClient,
  AutocompleteResult,
  Place,
} from "@/registry/new-york/blocks/apple-maps-autocomplete/apple-maps-client"

type FixtureFile = {
  autocomplete: { query: string; results: AutocompleteResult[] }[]
  completions: { completionUrl: string; place: Place | null }[]
  reverseGeocode: { latitude: number; longitude: number; place: Place | null }[]
}

const recorded = fixtures as FixtureFile

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function distanceKm(
  latitude: number,
  longitude: number,
  otherLatitude: number,
  otherLongitude: number,
) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180
  const latitudeDelta = toRadians(otherLatitude - latitude)
  const longitudeDelta = toRadians(otherLongitude - longitude)
  const start = toRadians(latitude)
  const end = toRadians(otherLatitude)
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(start) * Math.cos(end) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function matchingResults(typed: string): AutocompleteResult[] {
  let bestScore = 0
  const groups: AutocompleteResult[][] = []

  for (const record of recorded.autocomplete) {
    const query = normalize(record.query)
    let score = 0
    if (query === typed) score = 5
    else if (query.startsWith(typed)) score = 4
    else if (typed.startsWith(query) && query.length >= 3) score = 3
    else if (
      record.results.some((result) =>
        normalize(result.displayLines?.[0] ?? "").includes(typed),
      )
    ) {
      score = 2
    }

    if (score === 0) continue
    if (score > bestScore) {
      bestScore = score
      groups.length = 0
      groups.push(record.results)
    } else if (score === bestScore) {
      groups.push(record.results)
    }
  }

  const seen = new Set<string>()
  const results: AutocompleteResult[] = []
  for (const group of groups) {
    for (const result of group) {
      const key = result.completionUrl ?? result.displayLines?.join("|")
      if (!key || seen.has(key)) continue
      seen.add(key)
      results.push(result)
    }
  }
  return results
}

/**
 * Replays Apple Maps responses captured from the screening geocoder.
 * The location button returns the nearest captured place within 1,500 km.
 */
export function createFixtureAppleMapsClient(): AppleMapsClient {
  return {
    async autocomplete(query) {
      const typed = normalize(query)
      if (typed.length <= 2) return []
      return matchingResults(typed)
    },

    async complete(completionUrl) {
      return (
        recorded.completions.find(
          (entry) => entry.completionUrl === completionUrl,
        )?.place ?? null
      )
    },

    async reverseGeocode(latitude, longitude) {
      let nearest: Place | null = null
      let nearestDistance = Number.POSITIVE_INFINITY

      for (const sample of recorded.reverseGeocode) {
        const place = sample.place
        if (!place?.coordinate) continue
        const distance = distanceKm(
          latitude,
          longitude,
          place.coordinate.latitude,
          place.coordinate.longitude,
        )
        if (distance < nearestDistance) {
          nearest = place
          nearestDistance = distance
        }
      }

      if (nearestDistance > 1500) return null
      return nearest
    },
  }
}
