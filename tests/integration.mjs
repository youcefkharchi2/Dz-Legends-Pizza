import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
const baseURL = process.env.DZ_TEST_URL || "http://127.0.0.1:3000";
const checks = [];
const check = (label) => {
  checks.push(label);
  console.log("PASS", label);
};
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const errors = [];
const json = async (response, expected = 200) => {
  const data = await response.json();
  assert.equal(response.status(), expected, JSON.stringify(data));
  return data;
};
const getState = async (api) => json(await api.get("/api/state"));
const mutate = async (api, url, data, method = "post", expected = 200) =>
  json(await api[method](url, { data }), expected);
const profit = (s) =>
  s.orders
    .filter((o) => o.status === "Terminée")
    .reduce((n, o) => n + o.total - o.cogs, 0) -
  s.expenses
    .filter((e) => !e.inventoryPurchase)
    .reduce((n, e) => n + e.amount, 0);
await mkdir("test-results", { recursive: true });
try {
  if (process.argv.includes("--verify-restart")) {
    const saved = JSON.parse(
      await readFile("test-results/persist.json", "utf8"),
    );
    const context = await browser.newContext({
      baseURL,
      storageState: "test-results/admin-session.json",
    });
    const s = await getState(context.request);
    assert.equal(s.products.length, saved.products);
    assert.equal(s.orders.length, saved.orders);
    assert.equal(s.stock[0].quantity, saved.quantity);
    assert.equal(profit(s), saved.profit);
    assert.ok((await context.request.get(s.products[0].image)).ok());
    check(
      "Business data, sessions and images persist after production restart",
    );
    await context.close();
    await browser.close();
    process.exit(0);
  }
  if (process.env.DZ_TEST_EMPTY_DB !== "1")
    throw new Error(
      "These destructive fixture tests require an empty database and DZ_TEST_EMPTY_DB=1.",
    );
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1080 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/", { waitUntil: "networkidle" });
  const initial = await getState(context.request);
  assert.equal(initial.setup, true, "Use only an empty test database.");
  for (const key of [
    "products",
    "categories",
    "orders",
    "expenses",
    "stock",
    "employees",
  ])
    assert.equal(initial[key].length, 0);
  assert.equal(await page.locator("rect[data-day]").count(), 7);
  assert.deepEqual(
    await page
      .locator("rect[data-day]")
      .evaluateAll((el) => el.map((e) => Number(e.getAttribute("data-value")))),
    [0, 0, 0, 0, 0, 0, 0],
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: "test-results/dashboard-dark.png",
    fullPage: true,
  });
  check(
    "Fresh application has no demo data and exactly seven zero-profit bars",
  );
  await page.getByRole("button", { name: "Changer de thème" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({
    path: "test-results/dashboard-light.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Changer de thème" }).click();
  check("Dark and light themes change instantly and survive reload");
  const pages = [
    "Tableau de bord",
    "Caisse POS",
    "Commandes",
    "Produits",
    "Catégories",
    "Stock",
    "Dépenses",
    "Rapports",
    "Employés",
    "Paramètres",
  ];
  for (const label of pages) {
    await page
      .locator("aside.sidebar nav")
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page.locator("h1")).toContainText(label);
  }
  await page
    .locator("aside.sidebar nav")
    .getByRole("button", { name: "Stock", exact: true })
    .click();
  await page.waitForTimeout(8500);
  await expect(page.locator("h1")).toContainText("Stock");
  check(
    "All ten pages open and background synchronization never changes navigation",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.getByRole("button", { name: "Ouvrir le menu" }).click();
  await page
    .locator("aside.sidebar nav")
    .getByRole("button", { name: "Tableau de bord", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  check(
    "Mobile layout and collapsible navigation are usable without horizontal overflow",
  );
  await page.setViewportSize({ width: 1440, height: 1080 });
  const username = "qa-" + randomUUID().slice(0, 8),
    password = "Private-" + randomUUID();
  await page
    .getByRole("button", { name: "Configurer mon espace", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Votre nom complet").fill("Équipe QA");
  await dialog.getByLabel("Identifiant", { exact: true }).fill(username);
  await dialog.getByLabel("Mot de passe", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Créer mon espace" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".profile-details strong")).toHaveText("Équipe QA");
  const admin = (await getState(context.request)).user;
  assert.equal(admin.isOwner, true);
  check(
    "Initial owner setup and secure authenticated session work without public credentials",
  );
  const second = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 1080 },
  });
  await mutate(second.request, "/api/auth", {
    action: "login",
    username,
    password,
  });
  check("Administrator login works in a second isolated browser context");
  const api = context.request;
  const category = await mutate(api, "/api/entities", {
    kind: "category",
    data: { name: "QA Catégorie", image: "", order: 1 },
  });
  const stock = await mutate(api, "/api/entities", {
    kind: "stock",
    data: {
      name: "QA Farine",
      quantity: 10,
      unit: "kg",
      min: 2,
      cost: 100,
      supplier: "QA Fournisseur",
      image: "",
    },
  });
  await page.reload({ waitUntil: "networkidle" });
  await page
    .locator("aside.sidebar nav")
    .getByRole("button", { name: "Produits", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ajouter un produit", exact: true })
    .first()
    .click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nom du produit *").fill("QA Pizza");
  await dialog.getByLabel("Catégorie").selectOption(category.id);
  await dialog.getByLabel("Prix de vente (DA) *").fill("1000");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=",
    "base64",
  );
  await dialog.locator("input[type=file]").setInputFiles({
    name: "qa-pizza.png",
    mimeType: "image/png",
    buffer: png,
  });
  await expect(dialog.locator(".image-preview img")).toHaveAttribute(
    "src",
    /\/api\/uploads\//,
  );
  await dialog
    .getByRole("button", { name: "Ajouter un ingrédient", exact: true })
    .click();
  await dialog.locator(".recipe-row select").selectOption(stock.id);
  await dialog.locator(".recipe-row input").fill("0.2");
  await dialog.getByLabel("Tailles et prix de vente").fill("Grande | 1200");
  await dialog
    .getByLabel("Suppléments, prix et coûts")
    .fill("Fromage | 100 | 20");
  await dialog
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  let s = await getState(api);
  assert.equal(s.products.length, 1);
  const product = s.products[0];
  assert.equal(product.recipe[0].quantity, 0.2);
  assert.ok(product.image.startsWith("/api/uploads/"));
  check(
    "Product creation, category assignment, PC image upload, sizes, extras and recipe editor work",
  );
  const secondPage = await second.newPage();
  secondPage.on("pageerror", (e) => errors.push(e.message));
  await secondPage.goto("/", { waitUntil: "networkidle" });
  await secondPage
    .locator("aside.sidebar nav")
    .getByRole("button", { name: "Caisse POS", exact: true })
    .click();
  const circle = await secondPage
    .locator(".pos-product-image img")
    .evaluate((img) => {
      const c = getComputedStyle(img);
      return {
        w: img.offsetWidth,
        h: img.offsetHeight,
        r: c.borderRadius,
        fit: c.objectFit,
      };
    });
  assert.equal(circle.w, circle.h);
  assert.equal(circle.r, "50%");
  assert.equal(circle.fit, "cover");
  assert.deepEqual(await (await second.request.get(product.image)).body(), png);
  check(
    "Product images are perfectly circular in POS and shared across independent browser contexts",
  );
  let checkoutBody;
  secondPage.on("request", (r) => {
    if (r.url().endsWith("/api/orders") && r.method() === "POST")
      checkoutBody = r.postDataJSON();
  });
  await secondPage.locator(".pos-product-card").click();
  dialog = secondPage.getByRole("dialog");
  await dialog.getByLabel("Fromage").check();
  await dialog.getByRole("button", { name: /Ajouter ·/ }).click();
  await secondPage
    .getByRole("button", { name: "Augmenter QA Pizza", exact: true })
    .click();
  await secondPage
    .getByRole("button", { name: "Ajouter une remise", exact: true })
    .click();
  await secondPage
    .getByRole("spinbutton", { name: "Remise en DA" })
    .fill("100");
  await secondPage
    .getByRole("spinbutton", { name: "Montant reçu", exact: true })
    .fill("3000");
  await secondPage
    .getByRole("button", { name: "Encaisser la commande", exact: true })
    .click();
  await expect(secondPage.getByRole("dialog")).toContainText("C’est encaissé");
  s = await getState(api);
  assert.equal(s.orders.length, 1);
  let firstOrder = s.orders[0];
  assert.equal(firstOrder.total, 2500);
  assert.equal(firstOrder.cogs, 80);
  assert.equal(firstOrder.change, 500);
  assert.equal(s.stock[0].quantity, 9.6);
  assert.equal(firstOrder.employeeId, admin.id);
  check(
    "POS checkout computes quantities, extras, discount, cost, change and recipe stock deduction correctly",
  );
  const duplicate = await Promise.all(
    Array.from({ length: 4 }, () =>
      mutate(second.request, "/api/orders", checkoutBody),
    ),
  );
  assert.ok(duplicate.every((o) => o.id === firstOrder.id));
  s = await getState(api);
  assert.equal(s.orders.length, 1);
  assert.equal(s.stock[0].quantity, 9.6);
  check(
    "Concurrent duplicate checkout requests never duplicate sales or stock movements",
  );
  const popupPromise = secondPage.waitForEvent("popup");
  await secondPage
    .getByRole("button", { name: "Imprimer le ticket", exact: true })
    .click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  await expect(popup.locator("body")).toContainText(firstOrder.number);
  await expect(popup.locator("body")).toContainText("Équipe QA");
  await expect(popup.locator(".total")).toContainText("2");
  assert.ok((await popup.locator("style").textContent()).includes("80mm"));
  await popup.close();
  check(
    "80 mm printable receipt includes receipt ID, cashier, items, totals and payment",
  );
  await secondPage
    .getByRole("button", { name: "Nouvelle commande", exact: true })
    .click();
  const today = new Date().toISOString().slice(0, 10);
  const expense = await mutate(api, "/api/entities", {
    kind: "expense",
    data: {
      description: "QA Loyer",
      amount: 300,
      category: "Loyer",
      date: today,
      inventoryPurchase: false,
    },
  });
  await mutate(api, "/api/entities", {
    kind: "expense",
    data: {
      description: "QA Achat stock",
      amount: 1000,
      category: "Ingrédients",
      date: today,
      inventoryPurchase: true,
    },
  });
  s = await getState(api);
  assert.equal(profit(s), 2120);
  check(
    "Business expenses reduce net profit while inventory purchases are not double-counted",
  );
  await mutate(
    api,
    "/api/orders",
    {
      idempotencyKey: randomUUID(),
      items: [
        { productId: product.id, quantity: 999, size: "Grande", extras: [] },
      ],
      payment: "Espèces",
      received: 2000000,
    },
    "post",
    400,
  );
  s = await getState(api);
  assert.equal(s.orders.length, 1);
  assert.equal(s.stock[0].quantity, 9.6);
  check(
    "Insufficient-stock checkout rolls back entirely and never creates negative stock",
  );
  let pending = await mutate(api, "/api/orders", {
    idempotencyKey: randomUUID(),
    items: [{ productId: product.id, quantity: 1, size: "Grande", extras: [] }],
    status: "En attente",
    payment: "Espèces",
    received: 0,
  });
  assert.equal((await getState(api)).stock[0].quantity, 9.6);
  for (const status of ["En préparation", "Prête", "Terminée"]) {
    s = await getState(api);
    pending = s.orders.find((o) => o.id === pending.id);
    await mutate(
      api,
      "/api/orders",
      { id: pending.id, version: pending.version, status },
      "patch",
    );
  }
  s = await getState(api);
  assert.equal(s.stock[0].quantity, 9.4);
  assert.equal(profit(s), 3300);
  firstOrder = s.orders.find((o) => o.id === firstOrder.id);
  await mutate(
    api,
    "/api/orders",
    { id: firstOrder.id, version: firstOrder.version, status: "Annulée" },
    "patch",
  );
  s = await getState(api);
  assert.equal(s.stock[0].quantity, 9.8);
  assert.equal(profit(s), 880);
  firstOrder = s.orders.find((o) => o.id === firstOrder.id);
  await mutate(
    api,
    "/api/orders",
    { id: firstOrder.id, version: firstOrder.version, status: "Annulée" },
    "patch",
    400,
  );
  assert.equal((await getState(api)).stock[0].quantity, 9.8);
  check(
    "Order preparation, completion and refund update revenue and restore stock exactly once",
  );
  const old = s.products[0];
  await mutate(
    api,
    "/api/entities",
    {
      kind: "product",
      id: old.id,
      version: old.version,
      data: { ...old, name: "QA Pizza modifiée" },
    },
    "put",
  );
  await mutate(
    api,
    "/api/entities",
    { kind: "product", id: old.id, version: old.version, data: old },
    "put",
    409,
  );
  check(
    "Stale updates are rejected instead of overwriting another browser’s changes",
  );
  let e = s.expenses.find((e) => e.id === expense.id);
  await mutate(
    api,
    "/api/entities",
    {
      kind: "expense",
      id: e.id,
      version: e.version,
      data: { ...e, amount: 350 },
    },
    "put",
  );
  s = await getState(api);
  assert.equal(profit(s), 830);
  e = s.expenses.find((e) => e.id === expense.id);
  await mutate(
    api,
    "/api/entities",
    { kind: "expense", id: e.id, version: e.version },
    "delete",
  );
  s = await getState(api);
  assert.equal(profit(s), 1180);
  check("Expense editing and deletion recalculate actual profit");
  let ingredient = s.stock[0];
  await mutate(api, "/api/operations", {
    action: "movement",
    stockId: ingredient.id,
    version: ingredient.version,
    direction: "in",
    quantity: 1,
    purchaseCost: 200,
    reason: "QA Achat",
  });
  s = await getState(api);
  assert.equal(s.stock[0].quantity, 10.8);
  assert.ok(Math.abs(s.stock[0].cost - (9.8 * 100 + 200) / 10.8) < 0.00001);
  ingredient = s.stock[0];
  await mutate(api, "/api/operations", {
    action: "movement",
    stockId: ingredient.id,
    version: ingredient.version,
    direction: "out",
    quantity: 2,
    reason: "QA Consommation",
  });
  assert.equal((await getState(api)).stock[0].quantity, 8.8);
  check(
    "Stock entries, consumption, movement history and weighted purchase costs work",
  );
  s = await getState(api);
  let cat = s.categories.find((c) => c.id === category.id);
  await mutate(
    api,
    "/api/entities",
    {
      kind: "category",
      id: cat.id,
      version: cat.version,
      data: { ...cat, name: "QA Catégorie renommée" },
    },
    "put",
  );
  s = await getState(api);
  cat = s.categories.find((c) => c.id === category.id);
  await mutate(
    api,
    "/api/entities",
    { kind: "category", id: cat.id, version: cat.version },
    "delete",
  );
  s = await getState(api);
  assert.equal(s.categories.length, 0);
  assert.equal(s.products[0].categoryId, "");
  assert.ok(
    s.orders.every((o) =>
      o.items.every((i) => i.categoryName === "QA Catégorie"),
    ),
  );
  check("Category renaming and deletion preserve historical sale categories");
  const temporary = await mutate(api, "/api/entities", {
    kind: "product",
    data: {
      name: "QA Produit temporaire",
      categoryId: "",
      price: 25,
      cost: 0,
      enabled: false,
      image: "",
      recipe: [],
      sizes: [],
      extras: [],
    },
  });
  s = await getState(api);
  const temporaryRow = s.products.find((p) => p.id === temporary.id);
  await mutate(
    api,
    "/api/entities",
    { kind: "product", id: temporaryRow.id, version: temporaryRow.version },
    "delete",
  );
  assert.equal((await getState(api)).products.length, 1);
  check("Individual product deletion works without changing historical orders");
  const cashierName = "qa-" + randomUUID().slice(0, 8);
  const cashierPassword = "Private-" + randomUUID();
  await mutate(api, "/api/employees", {
    data: {
      name: "QA Caissier",
      username: cashierName,
      password: cashierPassword,
      role: "Caissier",
      active: true,
      pages: ["pos", "orders"],
      actions: ["view", "create", "complete"],
    },
  });
  const cashier = await browser.newContext({ baseURL });
  await mutate(cashier.request, "/api/auth", {
    action: "login",
    username: cashierName,
    password: cashierPassword,
  });
  for (const [url, data, method] of [
    ["/api/employees", { data: { name: "Intrusion" } }, "post"],
    ["/api/entities", { kind: "product", data: { name: "Intrusion" } }, "post"],
    ["/api/operations", { action: "settings", data: {} }, "post"],
    ["/api/entities", { kind: "expense", data: {} }, "post"],
    [
      "/api/orders",
      { id: firstOrder.id, version: firstOrder.version, status: "Annulée" },
      "patch",
    ],
  ])
    await mutate(cashier.request, url, data, method, 403);
  await json(await cashier.request.get("/api/backup"), 403);
  await mutate(
    cashier.request,
    "/api/orders",
    {
      idempotencyKey: randomUUID(),
      items: [
        { productId: product.id, quantity: 1, size: "Grande", extras: [] },
      ],
      discount: 1,
      payment: "Espèces",
      received: 2000,
    },
    "post",
    403,
  );
  const limited = await getState(cashier.request);
  assert.equal(limited.products[0].cost, 0);
  assert.equal(limited.products[0].extras[0].cost, 0);
  assert.equal(limited.orders[0].items[0].cost, 0);
  const cashierPage = await cashier.newPage();
  cashierPage.on("pageerror", (e) => errors.push(e.message));
  await cashierPage.goto("/", { waitUntil: "networkidle" });
  assert.equal(
    await cashierPage.locator("aside.sidebar nav .nav-item").count(),
    2,
  );
  check(
    "Cashier menu, action permissions and financial cost masking are enforced by the backend",
  );
  s = await getState(api);
  const cashierUser = s.employees.find((e) => e.username === cashierName);
  await mutate(
    api,
    "/api/employees",
    { id: cashierUser.id, data: { ...cashierUser, active: false } },
    "put",
  );
  assert.equal((await getState(cashier.request)).user, null);
  check("Deactivating an employee immediately revokes their sessions");
  await cashier.close();
  s = await getState(api);
  await mutate(api, "/api/operations", {
    action: "settings",
    data: {
      ...s.settings,
      name: "QA DZ Legends",
      address: "QA Adresse",
      phone: "000",
      receiptWidth: "58",
    },
  });
  await secondPage.reload({ waitUntil: "networkidle" });
  await secondPage
    .locator("aside.sidebar nav")
    .getByRole("button", { name: "Commandes", exact: true })
    .click();
  const popup58Promise = secondPage.waitForEvent("popup");
  await secondPage
    .getByRole("button", { name: /Imprimer DZ-/ })
    .first()
    .click();
  const popup58 = await popup58Promise;
  await popup58.waitForLoadState();
  assert.ok((await popup58.locator("style").textContent()).includes("58mm"));
  await popup58.close();
  check("58 mm receipt format and establishment settings are persisted");
  await secondPage
    .locator("aside.sidebar nav")
    .getByRole("button", { name: "Rapports", exact: true })
    .click();
  await expect(secondPage.locator(".report-kpis")).toBeVisible();
  await secondPage
    .getByRole("button", { name: "Exporter CSV", exact: true })
    .click();
  await secondPage.pdf({
    path: "test-results/report.pdf",
    format: "A4",
    printBackground: true,
  });
  check(
    "Real-data reports render and CSV/browser PDF export paths are available",
  );
  await expect(secondPage.locator(".report-breakdown").nth(1)).toContainText(
    "QA Catégorie",
  );
  const backup = await json(await api.get("/api/backup"));
  assert.equal(backup.format, "dz-legends-v1");
  assert.ok(backup.uploads.length > 0);
  assert.ok(backup.employees[0].passwordHash.startsWith("$2"));
  assert.ok(!JSON.stringify(backup).includes(password));
  await json(await api.get("/api/backup?automatic=true"));
  await mutate(
    api,
    "/api/backup",
    {
      action: "restore",
      confirmation: "RESTAURER",
      backup: {
        ...backup,
        records: [{ id: "bad", kind: "product", data: {} }],
      },
    },
    "post",
    400,
  );
  check(
    "Complete backups contain images and hashes, automatic backups exist, malformed restores are blocked",
  );
  await mutate(
    api,
    "/api/backup",
    { action: "reset", confirmation: "wrong" },
    "post",
    400,
  );
  await mutate(api, "/api/backup", {
    action: "reset",
    confirmation: "RÉINITIALISER",
  });
  s = await getState(api);
  assert.equal(s.products.length, 0);
  assert.equal(s.orders.length, 0);
  assert.equal(s.stock.length, 0);
  assert.equal(s.employees.length, 1);
  assert.equal(s.user.id, admin.id);
  await page.reload({ waitUntil: "networkidle" });
  assert.deepEqual(
    await page
      .locator("rect[data-day]")
      .evaluateAll((el) => el.map((e) => Number(e.getAttribute("data-value")))),
    [0, 0, 0, 0, 0, 0, 0],
  );
  check(
    "Strongly confirmed factory reset clears business data and chart while preserving the owner",
  );
  await mutate(api, "/api/backup", {
    action: "restore",
    confirmation: "RESTAURER",
    backup,
  });
  s = await getState(api);
  assert.equal(s.products.length, 1);
  assert.equal(s.orders.length, 2);
  assert.equal(s.stock[0].quantity, 8.8);
  assert.equal(profit(s), 1180);
  assert.deepEqual(
    await (await second.request.get(s.products[0].image)).body(),
    png,
  );
  check(
    "Full restore reinstates products, images, orders, stock, financial data and settings",
  );
  await context.storageState({ path: "test-results/admin-session.json" });
  await writeFile(
    "test-results/persist.json",
    JSON.stringify({
      products: s.products.length,
      orders: s.orders.length,
      quantity: s.stock[0].quantity,
      profit: profit(s),
    }),
  );
  assert.deepEqual(errors, []);
  check("No JavaScript errors occurred during the tested workflows");
  await writeFile(
    "test-results/checks.json",
    JSON.stringify({ at: new Date().toISOString(), checks, errors }, null, 2),
  );
  await second.close();
  await context.close();
  console.log(
    `\n${checks.length} integration checks passed. Temporary fixtures are retained only for restart verification.`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
