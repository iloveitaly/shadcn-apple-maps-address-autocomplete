import { expect, test } from "@playwright/test"
import registry from "../../registry.json" with { type: "json" }

test("renders every registry item under a repository subpath without runtime errors", async ({
  page,
  request,
}) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("./")
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    registry.name,
  )
  for (const item of registry.items) {
    const section = page.getByRole("region", { name: item.title })
    await expect(section).toBeVisible()
    await expect(
      section.getByRole("link", { name: "Show source" }),
    ).toHaveAttribute("href", new RegExp(item.files[0].path))
    const link = await section
      .getByRole("link", { name: "Open in v0" })
      .getAttribute("href")
    expect(new URL(link!).searchParams.get("url")).toBe(
      `https://registry.example.test/registry-preview/r/${item.name}.json`,
    )
    const response = await request.get(`r/${item.name}.json`)
    expect(response.ok()).toBeTruthy()
    expect((await response.json()).name).toBe(item.name)
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy()
  expect(errors).toEqual([])
})

test("searches a captured address and copies the install URL", async ({
  page,
}) => {
  await page.goto("./")
  const item = registry.items.find(
    (entry) => entry.name === "apple-maps-autocomplete",
  )
  const section = page.getByRole("region", { name: item!.title })
  await section
    .getByRole("button", {
      name: "Copy install command for apple-maps-autocomplete",
    })
    .click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    "pnpm dlx shadcn@latest add https://registry.example.test/registry-preview/r/apple-maps-autocomplete.json",
  )

  const search = section.getByLabel("Search address")
  await search.fill("90210")
  await section.getByRole("option", { selected: true }).click()
  await expect(search).toHaveValue("90210")
  await expect(section.getByText("Selected address")).toBeVisible()
  await expect(section.getByText("Los Angeles, CA 90210")).toBeVisible()
  await expect(section.getByText(/34\.10252/)).toBeVisible()

  await section.getByRole("button", { name: "Clear address" }).click()
  await expect(search).toHaveValue("")
  await expect(section.getByText("Selected address")).toHaveCount(0)
  await expect(section.getByLabel("Disabled")).toBeDisabled()
})

test("keeps the gallery usable on mobile and in dark mode", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("./")
  await page.evaluate(() => document.documentElement.classList.add("dark"))
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy()
})
