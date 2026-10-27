import { useMemo, useState } from "react"

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { createFixtureAppleMapsClient } from "@/app/examples/fixture-client"
import {
  AppleMapsAutocomplete,
  createAppleMapsClient,
  type AutocompleteResult,
} from "@/registry/new-york/blocks/apple-maps-autocomplete/apple-maps-autocomplete"

function formatStructuredAddress(address: AutocompleteResult) {
  const structured = address.structuredAddress
  if (!structured) return null
  const cityLine = [structured.locality, structured.administrativeAreaCode]
    .filter(Boolean)
    .join(", ")
  return [structured.fullThoroughfare, cityLine, structured.postCode]
    .filter(Boolean)
    .join(" ")
}

export default function AppleMapsAutocompleteExample() {
  const [selected, setSelected] = useState<AutocompleteResult | null>(null)
  const [countryCode, setCountryCode] = useState<string | null>(null)
  const token = import.meta.env.VITE_APPLE_MAPS_TOKEN
  const client = useMemo(
    () =>
      token
        ? createAppleMapsClient({ accessToken: token })
        : createFixtureAppleMapsClient(),
    [token],
  )

  return (
    <FieldGroup className="w-full max-w-md gap-6">
      <Field>
        <FieldLabel>Search address</FieldLabel>
        <AppleMapsAutocomplete
          label="Search address"
          client={client}
          placeholder="90210, Denver, 1 Infinite Loop..."
          onAddressSelect={(address, country) => {
            setSelected(address)
            setCountryCode(country ?? null)
          }}
        />
        <FieldDescription>
          {token
            ? "Queries Apple Maps with the access token in this environment."
            : "Preview replays captured Apple Maps responses. Try 90210, 1600 Pennsylvania, 1 Infinite Loop, Denver, 350 5th Avenue, or 11 Wall Street."}
        </FieldDescription>
      </Field>

      {selected && (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">Selected address</p>
          <p>{selected.displayLines?.filter(Boolean).join(", ")}</p>
          {formatStructuredAddress(selected) && (
            <p className="text-muted-foreground">
              {formatStructuredAddress(selected)}
            </p>
          )}
          {selected.location && (
            <p className="text-muted-foreground">
              {selected.location.latitude.toFixed(5)},{" "}
              {selected.location.longitude.toFixed(5)}
              {countryCode ? ` · ${countryCode}` : ""}
            </p>
          )}
        </div>
      )}

      <Field data-disabled>
        <FieldLabel>Disabled</FieldLabel>
        <AppleMapsAutocomplete
          label="Disabled"
          client={client}
          disabled
          placeholder="Search address..."
          onAddressSelect={() => {}}
        />
      </Field>
    </FieldGroup>
  )
}
