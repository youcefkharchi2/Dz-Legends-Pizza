import { chromium, firefox, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
const baseURL = process.env.DZ_TEST_URL || "http://127.0.0.1:3000";
const browsers = [];
const report = [];
const pass = (label) => {
  report.push(label);
  console.log("PASS", label);
};
const json = async (response) => {
  const body = await response.json();
  assert.ok(response.ok(), JSON.stringify(body));
  return body;
};
try {
  const chrome = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  const fox = await firefox.launch({ headless: true });
  browsers.push(chrome, fox);
  const a = await chrome.newContext({
    baseURL,
    storageState: "test-results/admin-session.json",
    viewport: { width: 1440, height: 1000 },
  });
  const b = await fox.newContext({
    baseURL,
    storageState: "test-results/admin-session.json",
    viewport: { width: 1440, height: 1000 },
  });
  const pageA = await a.newPage(),
    pageB = await b.newPage();
  const errors = [];
  for (const p of [pageA, pageB])
    p.on("pageerror", (e) => errors.push(e.message));
  await Promise.all([
    pageA.goto("/", { waitUntil: "networkidle" }),
    pageB.goto("/", { waitUntil: "networkidle" }),
  ]);
  const stateA = await json(await a.request.get("/api/state"));
  const stateB = await json(await b.request.get("/api/state"));
  assert.equal(stateA.orders.length, stateB.orders.length);
  assert.equal(stateA.products[0].id, stateB.products[0].id);
  assert.equal(stateA.stock[0].quantity, stateB.stock[0].quantity);
  await pageB
    .locator("aside.sidebar nav")
    .getByRole("button", { name: "Caisse POS", exact: true })
    .click();
  const image = pageB.locator(".pos-product-image img");
  await expect(image).toBeVisible();
  const geometry = await image.evaluate((el) => ({
    width: el.offsetWidth,
    height: el.offsetHeight,
    radius: getComputedStyle(el).borderRadius,
    fit: getComputedStyle(el).objectFit,
    naturalWidth: el.naturalWidth,
  }));
  assert.equal(geometry.width, geometry.height);
  assert.equal(geometry.radius, "50%");
  assert.equal(geometry.fit, "cover");
  assert.ok(geometry.naturalWidth > 0);
  pass(
    "Chromium and Firefox share saved products, orders, inventory and actual uploaded images",
  );
  const expense = await json(
    await a.request.post("/api/entities", {
      data: {
        kind: "expense",
        data: {
          description: "QA Bénéfice négatif",
          amount: 2000,
          category: "Autre",
          date: new Date().toISOString().slice(0, 10),
          inventoryPurchase: false,
        },
      },
    }),
  );
  await pageA.reload({ waitUntil: "networkidle" });
  await expect(pageA.locator("rect[data-day]").last()).toHaveAttribute(
    "data-value",
    "-820",
  );
  await pageA.locator("rect[data-day]").last().hover();
  await expect(pageA.locator(".chart-tooltip")).toContainText("820");
  const bar = await pageA
    .locator("rect[data-day]")
    .last()
    .evaluate((el) => Number(el.getAttribute("height")));
  assert.ok(bar > 3);
  pass(
    "Seven-day chart represents a real negative profit with exact tooltip and highlighted today",
  );
  await pageB
    .locator("aside.sidebar nav")
    .getByRole("button", { name: "Tableau de bord", exact: true })
    .click();
  await expect(pageB.locator("rect[data-day]").last()).toHaveAttribute(
    "data-value",
    "-820",
    { timeout: 12000 },
  );
  pass(
    "A Chromium expense updates the Firefox dashboard without manual reloading",
  );
  let s = await json(await a.request.get("/api/state"));
  const row = s.expenses.find((e) => e.id === expense.id);
  await json(
    await a.request.delete("/api/entities", {
      data: { kind: "expense", id: row.id, version: row.version },
    }),
  );
  await expect(pageB.locator("rect[data-day]").last()).toHaveAttribute(
    "data-value",
    "1180",
    { timeout: 12000 },
  );
  await expect(pageB.locator("h1")).toContainText("Tableau de bord");
  pass(
    "Background synchronization updates values without changing the selected page",
  );
  await pageA
    .locator("aside.sidebar nav")
    .getByRole("button", { name: "Stock", exact: true })
    .click();
  await pageA
    .locator('.table-actions button[title="Modifier"]')
    .first()
    .click();
  const dialog = pageA.getByRole("dialog");
  await dialog.getByLabel("Fournisseur").fill("QA Fournisseur modifié");
  await dialog
    .getByRole("button", { name: "Enregistrer les modifications", exact: true })
    .click();
  await expect(pageA.getByRole("dialog")).toHaveCount(0);
  s = await json(await a.request.get("/api/state"));
  assert.equal(s.stock[0].supplier, "QA Fournisseur modifié");
  pass("Inventory with a fractional weighted cost can be edited successfully");
  await pageB.getByRole("button", { name: "Changer de thème" }).click();
  await expect(pageB.locator("html")).toHaveAttribute("data-theme", "light");
  await pageB.reload({ waitUntil: "networkidle" });
  await expect(pageB.locator("html")).toHaveAttribute("data-theme", "light");
  await pageB.screenshot({
    path: "test-results/firefox-light.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  pass(
    "Firefox theme persistence works and the tested workflows produce no JavaScript errors",
  );
  await writeFile(
    "test-results/cross-browser-checks.json",
    JSON.stringify(
      { at: new Date().toISOString(), checks: report, errors },
      null,
      2,
    ),
  );
  await a.close();
  await b.close();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  for (const b of browsers) await b.close();
}
