import { fail } from "./server";
import { STATUSES } from "./types";
type Item = Record<string, any>;
export function validateBackup(data: Item) {
  const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v);
  const positive = (v: unknown) => finite(v) && Number(v) >= 0;
  const named = (v: Item) =>
    typeof v.name === "string" && v.name.length > 0 && v.name.length <= 180;
  const option = (v: Item) =>
    named(v) && positive(v.price) && positive(v.cost ?? 0);
  const recipe = (v: Item) =>
    typeof v.stockId === "string" && finite(v.quantity) && v.quantity > 0;
  if (
    data?.format !== "dz-legends-v1" ||
    !Array.isArray(data.records) ||
    !Array.isArray(data.uploads) ||
    !Array.isArray(data.employees) ||
    !Array.isArray(data.settings)
  )
    fail("Fichier de sauvegarde non reconnu.");
  if (
    data.records.length > 100000 ||
    data.uploads.length > 10000 ||
    data.employees.length > 500
  )
    fail("Cette sauvegarde dépasse les limites de sécurité.");
  const ids = new Set<string>();
  for (const row of data.records) {
    if (
      !row ||
      typeof row.id !== "string" ||
      ids.has(row.id) ||
      !row.data ||
      typeof row.data !== "object"
    )
      fail("Enregistrement de sauvegarde invalide.");
    ids.add(row.id);
    const r = row.data;
    let valid = false;
    switch (row.kind) {
      case "product":
        valid =
          named(r) &&
          positive(r.price) &&
          positive(r.cost) &&
          typeof r.enabled === "boolean" &&
          Array.isArray(r.recipe) &&
          r.recipe.every(recipe) &&
          Array.isArray(r.sizes) &&
          r.sizes.every(option) &&
          Array.isArray(r.extras) &&
          r.extras.every(option);
        break;
      case "category":
        valid = named(r) && positive(r.order);
        break;
      case "stock":
        valid =
          named(r) &&
          finite(r.quantity) &&
          positive(r.min) &&
          positive(r.cost) &&
          ["kg", "g", "L", "ml", "pièces"].includes(r.unit);
        break;
      case "expense":
        valid =
          typeof r.description === "string" &&
          positive(r.amount) &&
          typeof r.date === "string" &&
          !isNaN(Date.parse(r.date)) &&
          typeof r.category === "string";
        break;
      case "order":
        valid =
          typeof r.number === "string" &&
          STATUSES.includes(r.status) &&
          Array.isArray(r.items) &&
          r.items.every(
            (i: Item) =>
              named(i) &&
              positive(i.price) &&
              positive(i.quantity) &&
              positive(i.cost ?? 0) &&
              Array.isArray(i.extras) &&
              Array.isArray(i.recipe) &&
              i.recipe.every(recipe),
          ) &&
          positive(r.total) &&
          positive(r.subtotal) &&
          positive(r.discount) &&
          positive(r.cogs) &&
          positive(r.received) &&
          positive(r.change) &&
          typeof r.date === "string" &&
          !isNaN(Date.parse(r.date));
        break;
      case "movement":
        valid =
          named(r) &&
          finite(r.delta) &&
          typeof r.stockId === "string" &&
          typeof r.date === "string" &&
          !isNaN(Date.parse(r.date));
        break;
    }
    if (!valid) fail(`Sauvegarde invalide : ${row.kind || "type inconnu"}.`);
  }
  const imageIds = new Set();
  for (const f of data.uploads) {
    if (
      !f ||
      typeof f.id !== "string" ||
      imageIds.has(f.id) ||
      !["image/png", "image/jpeg", "image/webp"].includes(f.mime) ||
      typeof f.content !== "string" ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(f.content) ||
      f.content.length > 7 * 1024 * 1024
    )
      fail("Image de sauvegarde invalide.");
    imageIds.add(f.id);
  }
  const users = new Set();
  for (const e of data.employees) {
    if (
      !e ||
      typeof e.id !== "string" ||
      !named(e) ||
      typeof e.username !== "string" ||
      users.has(e.username) ||
      typeof e.passwordHash !== "string" ||
      !/^\$2[aby]\$/.test(e.passwordHash) ||
      !Array.isArray(e.pages) ||
      !Array.isArray(e.actions)
    )
      fail("Compte de sauvegarde invalide.");
    users.add(e.username);
  }
  if (
    data.settings.length > 1 ||
    data.settings.some(
      (s: Item) => s.id !== "main" || !s.data || !named(s.data),
    )
  )
    fail("Paramètres de sauvegarde invalides.");
}
