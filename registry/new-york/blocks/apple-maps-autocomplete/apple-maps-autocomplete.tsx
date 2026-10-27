"use client"

import * as React from "react"
import { Command as CommandPrimitive } from "cmdk"
import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react"

import { MapPin, SearchIcon, X } from "lucide-react"

import { Command, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"
import {
  createAppleMapsClient,
  type AppleMapsAccessToken,
  type AppleMapsClient,
  type AutocompleteResult,
} from "./apple-maps-client"

export type {
  AppleMapsClient,
  AutocompleteResult,
  Place,
  StructuredAddress,
} from "./apple-maps-client"
export { createAppleMapsClient }

// Password managers treat address inputs as profile fields.
const NO_AUTOFILL_PROPS = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-op-ignore": true,
  "data-bwignore": true,
  "data-lpignore": "true",
  "data-form-type": "other",
} as const

interface AppleMapsAutocompleteProps {
  onAddressSelect: (
    address: AutocompleteResult | null,
    countryCode?: string | null,
  ) => void
  /**
   * Maps Server API access token, or a function that returns a fresh one.
   * Ignored when `client` is set.
   */
  accessToken?: AppleMapsAccessToken
  /** Replaces the default Apple Maps client. Use this to call your own proxy. */
  client?: AppleMapsClient
  initialValue?: string | null
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Accessible name. cmdk renders this as the input's label. */
  label?: string
  autoFocus?: boolean
  /** Apple's autocomplete endpoint has no limit parameter; results are sliced locally. */
  maxResults?: number
  debounceMs?: number
  /** ISO country codes passed to Apple and used when a place has no country code. */
  limitToCountries?: string
  customFetchAddresses?: (
    query: string,
    limit: number,
  ) => Promise<AutocompleteResult[]>
}

interface AppleMapsAutocompleteHandle {
  triggerSearch: () => Promise<void>
}

function SearchCommandInput({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex h-9 items-center gap-2 px-3"
    >
      <SearchIcon className="size-4 shrink-0 opacity-50" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...NO_AUTOFILL_PROPS}
        {...props}
      />
    </div>
  )
}

type State = {
  isOpen: boolean
  results: AutocompleteResult[]
  isLoading: boolean
  error: string | null
}

type Action =
  | { type: "START_SEARCH" }
  | { type: "SEARCH_SUCCESS"; results: AutocompleteResult[] }
  | { type: "SEARCH_ERROR"; error: string }
  | { type: "CLEAR_RESULTS" }
  | { type: "CLOSE_DROPDOWN" }

const initialState: State = {
  isOpen: false,
  results: [],
  isLoading: false,
  error: null,
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "START_SEARCH":
      return { ...state, isLoading: true, error: null }
    case "SEARCH_SUCCESS":
      return {
        ...state,
        isLoading: false,
        results: action.results,
        isOpen: true,
      }
    case "SEARCH_ERROR":
      return { ...state, isLoading: false, error: action.error, results: [] }
    case "CLEAR_RESULTS":
      return { ...state, results: [], isLoading: false }
    case "CLOSE_DROPDOWN":
      if (!state.isOpen) return state
      return { ...state, isOpen: false }
    default:
      return state
  }
}

function resultKey(result: AutocompleteResult, index: number): string {
  return (
    result.completionUrl ?? result.displayLines?.join("|") ?? `result-${index}`
  )
}

function resultPrimaryLabel(result: AutocompleteResult): string {
  return result.displayLines?.[0] ?? ""
}

function resultSecondaryLabel(result: AutocompleteResult): string | undefined {
  return result.displayLines?.[1]
}

function fallbackCountryCode(limitToCountries: string): string | null {
  const codes = limitToCountries
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean)
  return codes.length === 1 ? codes[0] : null
}

const AppleMapsAutocomplete = React.forwardRef<
  AppleMapsAutocompleteHandle,
  AppleMapsAutocompleteProps
>(
  (
    {
      onAddressSelect,
      accessToken,
      client,
      initialValue = "",
      placeholder = "Search address...",
      disabled = false,
      className,
      label = "Search address",
      autoFocus = false,
      maxResults = 8,
      debounceMs = 300,
      limitToCountries = "US",
      customFetchAddresses,
    },
    ref,
  ) => {
    const inputRef = useRef<HTMLInputElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
      undefined,
    )
    const errorId = useId()

    const mapsClient = useMemo(() => {
      if (client) return client
      if (accessToken) {
        return createAppleMapsClient({ accessToken, limitToCountries })
      }
      return null
    }, [accessToken, client, limitToCountries])

    const clientRef = useRef(mapsClient)
    const customFetchRef = useRef(customFetchAddresses)
    const searchRequestRef = useRef(0)

    const [state, dispatch] = useReducer(reducer, initialState)
    const { isOpen, results, isLoading, error } = state

    const [inputValue, setInputValue] = useState(initialValue || "")
    const [isFocused, setIsFocused] = useState(false)
    const seenInitialValue = useRef(initialValue)

    useEffect(() => {
      clientRef.current = mapsClient
    }, [mapsClient])

    useEffect(() => {
      customFetchRef.current = customFetchAddresses
    }, [customFetchAddresses])

    useEffect(() => {
      if (initialValue !== seenInitialValue.current) {
        seenInitialValue.current = initialValue
        setInputValue(initialValue || "")
      }
    }, [initialValue])

    useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus()
      }
    }, [autoFocus])

    useEffect(() => {
      return () => {
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
        if (searchTimeoutRef.current !== undefined) {
          clearTimeout(searchTimeoutRef.current)
        }
      }
    }, [])

    const closeDropdown = useCallback(() => {
      dispatch({ type: "CLOSE_DROPDOWN" })
    }, [])

    const resolveAddresses = useCallback(
      async (query: string, limit: number): Promise<AutocompleteResult[]> => {
        if (!query) return []

        if (customFetchRef.current) {
          return (await customFetchRef.current(query, limit)).slice(0, limit)
        }

        const activeClient = clientRef.current
        if (!activeClient) {
          throw new Error("An Apple Maps access token or client is required.")
        }

        const addresses = await activeClient.autocomplete(query)
        return addresses.slice(0, limit)
      },
      [],
    )

    const performSearch = useCallback(
      async (value: string) => {
        const requestId = ++searchRequestRef.current
        if (value.length > 2) {
          dispatch({ type: "START_SEARCH" })
          try {
            const addresses = await resolveAddresses(value, maxResults)
            if (requestId !== searchRequestRef.current) return
            dispatch({ type: "SEARCH_SUCCESS", results: addresses })
          } catch (err) {
            if (requestId !== searchRequestRef.current) return
            console.error("Apple Maps autocomplete error", err)
            dispatch({
              type: "SEARCH_ERROR",
              error: "Could not fetch address suggestions.",
            })
          }
        } else {
          dispatch({ type: "CLEAR_RESULTS" })
          closeDropdown()
        }
      },
      [closeDropdown, maxResults, resolveAddresses],
    )

    const handleInputChange = (value: string) => {
      setInputValue(value)
      if (searchTimeoutRef.current !== undefined) {
        clearTimeout(searchTimeoutRef.current)
      }
      searchTimeoutRef.current = setTimeout(() => {
        void performSearch(value)
      }, debounceMs)
    }

    const handleSelect = useCallback(
      async (address: AutocompleteResult) => {
        searchRequestRef.current += 1
        if (blurTimeoutRef.current) {
          clearTimeout(blurTimeoutRef.current)
          blurTimeoutRef.current = null
        }

        setInputValue(resultPrimaryLabel(address))
        closeDropdown()
        dispatch({ type: "CLEAR_RESULTS" })

        // Autocomplete rarely includes structuredAddress. Follow completionUrl
        // so callers receive a coordinate and parsed address fields.
        let enrichedAddress = address
        let countryCode = fallbackCountryCode(limitToCountries)
        if (address.completionUrl && clientRef.current) {
          try {
            const place = await clientRef.current.complete(
              address.completionUrl,
            )
            if (place) {
              enrichedAddress = {
                ...address,
                location: place.coordinate ?? address.location,
                structuredAddress:
                  place.structuredAddress ?? address.structuredAddress,
              }
              if (place.countryCode) countryCode = place.countryCode
            }
          } catch (err) {
            console.warn(
              "Apple Maps search completion failed, falling back to the autocomplete result",
              err,
            )
          }
        }

        onAddressSelect(enrichedAddress, countryCode)
      },
      [closeDropdown, limitToCountries, onAddressSelect],
    )

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== "Enter") return

      const hasActiveSelection = !!listRef.current?.querySelector(
        '[data-slot="command-item"][data-selected="true"], [cmdk-item][data-selected="true"], [role="option"][aria-selected="true"]',
      )
      if (hasActiveSelection) return

      if (results.length > 0) {
        event.preventDefault()
        void handleSelect(results[0])
      }
    }

    const handleFocus = () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current)
        blurTimeoutRef.current = null
      }
      setIsFocused(true)
    }

    const handleBlur = () => {
      setIsFocused(false)
      blurTimeoutRef.current = setTimeout(() => {
        closeDropdown()
      }, 150)
    }

    const triggerSearch = useCallback(async () => {
      if (!inputValue) return
      dispatch({ type: "START_SEARCH" })
      try {
        const addresses = await resolveAddresses(inputValue, maxResults)
        if (addresses.length > 0) {
          await handleSelect(addresses[0])
        } else {
          dispatch({
            type: "SEARCH_ERROR",
            error: "No results found for this address.",
          })
        }
      } catch (err) {
        console.error("Apple Maps manual search error", err)
        dispatch({
          type: "SEARCH_ERROR",
          error: "An error occurred during the search.",
        })
      }
    }, [handleSelect, inputValue, maxResults, resolveAddresses])

    useImperativeHandle(ref, () => ({ triggerSearch }), [triggerSearch])

    const handleClear = () => {
      if (inputValue) onAddressSelect(null)
      setInputValue("")
      dispatch({ type: "CLEAR_RESULTS" })
      closeDropdown()
      inputRef.current?.focus()
    }

    const handleGetCurrentLocation = useCallback(async () => {
      if (!navigator.geolocation) {
        dispatch({
          type: "SEARCH_ERROR",
          error: "Geolocation is not supported by this browser.",
        })
        return
      }

      const activeClient = clientRef.current
      if (!activeClient) {
        dispatch({
          type: "SEARCH_ERROR",
          error: "An Apple Maps access token or client is required.",
        })
        return
      }

      try {
        const position = await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject)
          },
        )

        const { latitude, longitude } = position.coords
        const place = await activeClient.reverseGeocode(latitude, longitude)
        if (place) {
          const result: AutocompleteResult = {
            displayLines: place.formattedAddressLines ?? [],
            location: place.coordinate ?? null,
            structuredAddress: place.structuredAddress ?? null,
            completionUrl: null,
          }
          setInputValue(resultPrimaryLabel(result))
          onAddressSelect(result, place.countryCode ?? null)
          closeDropdown()
          dispatch({ type: "CLEAR_RESULTS" })
        } else {
          dispatch({
            type: "SEARCH_ERROR",
            error: "No address found for current location.",
          })
        }
      } catch (err) {
        let errorMessage = "Unable to retrieve your location."
        if (err instanceof GeolocationPositionError) {
          switch (err.code) {
            case err.PERMISSION_DENIED:
              errorMessage =
                "Location access denied. Please enable location services."
              break
            case err.POSITION_UNAVAILABLE:
              errorMessage = "Location information is unavailable."
              break
            case err.TIMEOUT:
              errorMessage = "The request to get user location timed out."
              break
          }
        }
        dispatch({ type: "SEARCH_ERROR", error: errorMessage })
      }
    }, [closeDropdown, onAddressSelect])

    const showClear = !disabled && Boolean(inputValue)
    const showLocation = !disabled && !inputValue

    return (
      <div className={cn("relative w-full", className)}>
        <Command
          label={label}
          shouldFilter={false}
          className="overflow-visible"
        >
          <div
            className={cn(
              "relative rounded-md border bg-background transition-all hover:border-teal-500",
              isFocused &&
                "border-slate-500 shadow-[0_0_6px_rgba(88,167,165,1)] hover:border-teal-500",
            )}
          >
            <SearchCommandInput
              ref={inputRef}
              value={inputValue}
              onValueChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder}
              disabled={disabled}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              aria-busy={isLoading}
              className={cn((showClear || showLocation) && "pr-9")}
            />
            {showClear && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear address"
                className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-2"
              >
                <div className="rounded-full p-1 transition-colors hover:bg-accent">
                  <X className="size-5 text-foreground" />
                </div>
              </button>
            )}
            {showLocation && (
              <button
                type="button"
                onClick={() => void handleGetCurrentLocation()}
                aria-label="Use current location"
                className="absolute inset-y-0 right-0 flex cursor-pointer items-center pr-2"
              >
                <div className="rounded-full p-1 transition-colors hover:bg-accent">
                  <MapPin className="size-5 text-foreground" />
                </div>
              </button>
            )}
          </div>

          {isOpen && (
            <div className="absolute top-full z-10 mt-1 w-full animate-in rounded-md border bg-popover text-popover-foreground shadow-md duration-200 fade-in">
              <CommandList ref={listRef} className="max-h-72">
                {results.length === 0 &&
                  inputValue.length > 2 &&
                  !isLoading && (
                    <div className="p-4 text-center text-sm">
                      No results found.
                    </div>
                  )}
                {results.map((address, index) => (
                  <CommandItem
                    key={resultKey(address, index)}
                    value={resultKey(address, index)}
                    onSelect={() => void handleSelect(address)}
                    className="cursor-pointer"
                  >
                    <div className="flex flex-col">
                      <p className="text-sm font-semibold">
                        {resultPrimaryLabel(address)}
                      </p>
                      {resultSecondaryLabel(address) && (
                        <p className="text-xs text-muted-foreground">
                          {resultSecondaryLabel(address)}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandList>
            </div>
          )}
        </Command>
        {isLoading && (
          <p className="sr-only" role="status">
            Searching addresses.
          </p>
        )}
        {error && (
          <p
            id={errorId}
            role="alert"
            className="mt-1 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    )
  },
)

AppleMapsAutocomplete.displayName = "AppleMapsAutocomplete"

export { AppleMapsAutocomplete }
export type { AppleMapsAutocompleteHandle, AppleMapsAutocompleteProps }
