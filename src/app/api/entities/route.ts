import { db } from "@/db";
import { records } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import {
  authorize,
  can,
  checkOrigin,
  errorResponse,
  fail,
  lock,
  makeBackup,
  num,
  text,
  type Transaction,
} from "@/lib/server";
const pages: Record<string, string> = {
  product: "products",
  category: "categories",
  stock: "stock",
  expense: "expenses",
};
async function validate(
  kind: string,
  data: Record<string, unknown>,
  tx: Transaction,
  employeeName: string,
) {
  const name = kind === "expense" ? "" : text(data.name, "Nom");
  const image =
    typeof data.image === "string" &&
    /^\/api\/uploads\/[a-f0-9-]+$/.test(data.image)
      ? data.image
      : "";
  if (kind === "category")
    return { name, image, order: num(data.order ?? 0, "Position") };
  if (kind === "stock")
    return {
      name,
      image,
      quantity: num(data.quantity, "Quantité"),
      unit: ["kg", "g", "L", "ml", "pièces"].includes(String(data.unit))
        ? data.unit
        : "pièces",
      min: num(data.min ?? 0, "Seuil minimal"),
      cost: num(data.cost ?? 0, "Coût unitaire"),
      supplier: String(data.supplier || "").slice(0, 180),
    };
  if (kind === "expense") {
    const date = String(data.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date)))
      fail("Date invalide.");
    return {
      description: text(data.description, "Description"),
      amount: num(data.amount, "Montant", 0.01),
      category: text(data.category, "Catégorie"),
      date,
      employeeName,
      inventoryPurchase: !!data.inventoryPurchase,
    };
  }
  const categoryId = String(data.categoryId || "");
  if (categoryId) {
    const [c] = await tx
      .select()
      .from(records)
      .where(and(eq(records.id, categoryId), eq(records.kind, "category")));
    if (!c) fail("Catégorie introuvable.");
  }
  const recipe = Array.isArray(data.recipe) ? data.recipe : [];
  if (recipe.length > 60) fail("Recette trop longue.");
  const seen = new Set();
  for (const item of recipe) {
    if (!item || typeof item !== "object") fail("Recette invalide.");
    const [stock] = await tx
      .select()
      .from(records)
      .where(and(eq(records.id, item.stockId), eq(records.kind, "stock")));
    if (!stock) fail("Un ingrédient de la recette est introuvable.");
    if (seen.has(item.stockId)) fail("Un ingrédient est présent deux fois.");
    seen.add(item.stockId);
    item.quantity = num(item.quantity, "Quantité de recette", 0.000001);
  }
  const options = (input: unknown) =>
    Array.isArray(input)
      ? input
          .slice(0, 30)
          .map((o) => ({
            name: text(o.name, "Option"),
            price: num(o.price, "Prix"),
            cost: num(o.cost ?? 0, "Coût"),
          }))
      : [];
  return {
    name,
    image,
    categoryId,
    price: num(data.price, "Prix de vente"),
    cost: num(data.cost ?? 0, "Coût produit"),
    enabled: data.enabled !== false,
    recipe,
    sizes: options(data.sizes),
    extras: options(data.extras),
  };
}
async function handle(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    const kind = String(body.kind);
    if (!pages[kind]) fail("Type de donnée invalide.");
    const action =
      request.method === "DELETE"
        ? "delete"
        : request.method === "PUT"
          ? "edit"
          : "create";
    const user = await authorize(pages[kind], action);
    const id = String(body.id || crypto.randomUUID());
    const result = await db.transaction(async (tx) => {
      await lock(tx);
      await makeBackup(tx);
      const [existing] = await tx
        .select()
        .from(records)
        .where(eq(records.id, id));
      if (action !== "create" && (!existing || existing.kind !== kind))
        fail("Élément introuvable.", 404);
      if (existing && action === "create")
        fail("Cet élément existe déjà.", 409);
      if (existing && body.version !== existing.version)
        fail(
          "Cet élément a été modifié dans un autre navigateur. Actualisez puis réessayez.",
          409,
        );
      if (action === "delete") {
        if (kind === "stock") {
          const products = await tx
            .select()
            .from(records)
            .where(eq(records.kind, "product"));
          if (
            products.some(
              (p) =>
                Array.isArray(p.data.recipe) &&
                p.data.recipe.some(
                  (r: { stockId: string }) => r.stockId === id,
                ),
            )
          )
            fail("Retirez cet ingrédient des recettes avant de le supprimer.");
        }
        if (kind === "category") {
          const products = await tx
            .select()
            .from(records)
            .where(eq(records.kind, "product"));
          for (const p of products)
            if (p.data.categoryId === id)
              await tx
                .update(records)
                .set({
                  data: { ...p.data, categoryId: "" },
                  version: p.version + 1,
                  updatedAt: new Date(),
                })
                .where(eq(records.id, p.id));
        }
        await tx.delete(records).where(eq(records.id, id));
        return { id };
      }
      const data = await validate(
        kind,
        body.data || {},
        tx,
        kind === "expense" && existing
          ? String(existing.data.employeeName)
          : user.name,
      );
      if (!can(user, pages[kind], "finance")) {
        const protectedData = data as Record<string, unknown>;
        if (kind === "product" || kind === "stock")
          protectedData.cost = existing?.data.cost ?? 0;
        if (kind === "product" && Array.isArray(protectedData.extras)) {
          const oldExtras = Array.isArray(existing?.data.extras)
            ? existing.data.extras
            : [];
          protectedData.extras = protectedData.extras.map(
            (e: Record<string, unknown>) => ({
              ...e,
              cost:
                oldExtras.find(
                  (o: Record<string, unknown>) => o.name === e.name,
                )?.cost ?? 0,
            }),
          );
        }
      }
      if (kind === "stock" && existing) {
        if (
          existing.data.unit !== (data as Record<string, unknown>).unit &&
          Number(existing.data.quantity) !== 0
        )
          fail(
            "Videz le stock avant de changer son unité, pour conserver des quantités et des coûts cohérents.",
          );
        const old = Number(existing.data.quantity);
        const next = Number((data as Record<string, unknown>).quantity);
        if (old !== next)
          fail(
            "Utilisez « Mouvement de stock » pour modifier la quantité et conserver l’historique.",
          );
      }
      if (action === "create") {
        await tx.insert(records).values({ id, kind, data });
        if (
          kind === "stock" &&
          Number((data as Record<string, unknown>).quantity) > 0
        )
          await tx
            .insert(records)
            .values({
              id: crypto.randomUUID(),
              kind: "movement",
              data: {
                stockId: id,
                name: data.name,
                delta: (data as Record<string, unknown>).quantity,
                unit: (data as Record<string, unknown>).unit,
                reason: "Stock initial",
                date: new Date().toISOString(),
                employeeName: user.name,
              },
            });
      } else
        await tx
          .update(records)
          .set({ data, version: existing.version + 1, updatedAt: new Date() })
          .where(eq(records.id, id));
      return { id };
    });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
