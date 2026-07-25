import { expect, test } from "@playwright/test";


test("participant can register, edit, find, and cancel a registration", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Move together.*Make good happen/ }),
  ).toBeVisible();
  await expect(page.getByText("Charity Fun Run · 2026").first()).toBeVisible();

  await page.getByRole("link", { name: /Save my place/ }).click();
  await expect(page).toHaveURL(/#\/register$/);

  await page.getByLabel("Full name").fill("Alex Morgan");
  await page.getByLabel("Email address").fill("alex@example.com");
  await page.getByLabel("Phone number").fill("+44 7700 900000");
  await page.getByRole("button", { name: /Complete registration/ }).click();

  await expect(page).toHaveURL(/#\/registrations\/\d+$/);
  await expect(
    page.getByRole("heading", { name: "Alex Morgan", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Confirmed")).toBeVisible();
  await expect(page.getByText("alex@example.com")).toBeVisible();

  await page.getByRole("link", { name: /Edit registration/ }).click();
  await expect(page).toHaveURL(/#\/registrations\/\d+\/edit$/);
  await page.getByLabel("Full name").fill("Alexandra Morgan");
  await page.getByLabel("Phone number").fill("+44 7700 900001");
  await page.getByRole("button", { name: /Save changes/ }).click();

  await expect(
    page.getByRole("heading", { name: "Alexandra Morgan", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("+44 7700 900001")).toBeVisible();

  await page.getByRole("link", { name: "Participants", exact: true }).click();
  await expect(page).toHaveURL(/#\/participants$/);
  await page.getByLabel("Search participants").fill("alexandra");
  await expect(
    page.getByRole("heading", { name: "Alexandra Morgan", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("link", {
      name: "View Alexandra Morgan's registration",
    })
    .click();
  await page.getByRole("button", { name: "Cancel registration" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Alexandra Morgan will be removed from the participant list.",
  );
  await dialog.getByRole("button", { name: "Yes, cancel it" }).click();

  await expect(page).toHaveURL(/#\/participants$/);
  await expect(
    page.getByRole("heading", { name: "The starting line is open" }),
  ).toBeVisible();

  const registrationsResponse = await page.request.get(
    "http://127.0.0.1:5000/api/registrations",
  );
  expect(registrationsResponse.ok()).toBe(true);
  expect(await registrationsResponse.json()).toMatchObject({
    count: 0,
    registrations: [],
  });
});
