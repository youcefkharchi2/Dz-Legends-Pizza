import { db } from "@/db";
import { records } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  authorize,
  can,
  checkOrigin,
  errorResponse,
  fail,
  getSettings,
  lock,
  makeBackup,
  num,
  round,
  type Transaction,
} from "@/lib/server";
import {
  STATUSES,
  type CartItem,
  type Order,
  type Product,
  type StockItem,
  type User,
} from "@/lib/types";
async function moveStock(
  tx: Transaction,
  order: Record<string, unknown>,
  orderId: string,
  user: User,
  direction: number,
) {
  const config = await getSettings(tx);
  const quantities = new Map<string, number>();
  for (const item of order.items as CartItem[])
    for (const ingredient of item.recipe || [])
      quantities.set(
        ingredient.stockId,
        (quantities.get(ingredient.stockId) || 0) +
          ingredient.quantity * item.quantity,
      );
  for (const [id, quantity] of quantities) {
    const [row] = await tx.select().from(records).where(eq(records.id, id));
    if (!row || row.kind !== "stock")
      fail("Un ingrédient de cette commande a été supprimé.");
    const stock = row.data as unknown as StockItem;
    const next =
      Math.round((stock.quantity + quantity * direction) * 1e6) / 1e6;
    if (!config.allowNegative && next < 0)
      fail(
        `Stock insuffisant : ${stock.name} (${stock.quantity} ${stock.unit} disponible).`,
      );
    await tx
      .update(records)
      .set({
        data: { ...row.data, quantity: next },
        version: row.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(records.id, id));
    await tx.insert(records).values({
      id: crypto.randomUUID(),
      kind: "movement",
      data: {
        stockId: id,
        name: stock.name,
        delta: quantity * direction,
        unit: stock.unit,
        reason:
          direction < 0
            ? "Vente " + order.number
            : "Remboursement " + order.number,
        date: new Date().toISOString(),
        employeeName: user.name,
        orderId,
      },
    });
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    const pending = body.status === "En attente";
    const user = await authorize("pos", pending ? "create" : "complete");
    const id = String(body.idempotencyKey || "");
    if (!/^[a-f0-9-]{36}$/i.test(id))
      fail("Identifiant de transaction invalide.");
    const result = await db.transaction(async (tx) => {
      await lock(tx);
      const [duplicate] = await tx
        .select()
        .from(records)
        .where(eq(records.id, id));
      if (duplicate) {
        if (duplicate.kind !== "order") fail("Identifiant déjà utilisé.", 409);
        return { id: duplicate.id, ...duplicate.data };
      }
      await makeBackup(tx);
      if (
        !Array.isArray(body.items) ||
        body.items.length === 0 ||
        body.items.length > 100
      )
        fail("Le panier est vide ou invalide.");
      const items: CartItem[] = [];
      for (const input of body.items) {
        const [row] = await tx
          .select()
          .from(records)
          .where(eq(records.id, String(input.productId)));
        if (!row || row.kind !== "product" || row.data.enabled === false)
          fail("Un produit du panier n’est plus disponible.");
        const p = row.data as unknown as Product;
        const quantity = num(input.quantity, "Quantité", 1);
        if (!Number.isInteger(quantity) || quantity > 999)
          fail("Quantité invalide.");
        const size = input.size
          ? p.sizes.find((s) => s.name === input.size)
          : undefined;
        if (input.size && !size) fail("La taille sélectionnée n’existe plus.");
        let price = size ? size.price : p.price;
        let cost = p.recipe.length ? 0 : p.cost;
        for (const recipe of p.recipe) {
          const [stock] = await tx
            .select()
            .from(records)
            .where(eq(records.id, recipe.stockId));
          if (!stock || stock.kind !== "stock")
            fail("Un ingrédient de la recette est introuvable.");
          cost += Number(stock.data.cost) * recipe.quantity;
        }
        const extras: string[] = Array.isArray(input.extras)
          ? [...new Set<string>(input.extras)]
          : [];
        for (const name of extras) {
          const extra = p.extras.find((e) => e.name === name);
          if (!extra) fail("Un supplément n’existe plus.");
          price += extra.price;
          cost += extra.cost || 0;
        }
        const [category] = p.categoryId
          ? await tx.select().from(records).where(eq(records.id, p.categoryId))
          : [];
        items.push({
          categoryId: p.categoryId,
          categoryName:
            category?.kind === "category"
              ? String(category.data.name)
              : "Sans catégorie",
          key: String(input.key || row.id),
          productId: row.id,
          name: p.name,
          image: p.image,
          quantity,
          price: round(price),
          cost: round(cost),
          recipe: p.recipe,
          size: size?.name || "",
          extras,
        });
      }
      const subtotal = round(
        items.reduce((s, i) => s + i.price * i.quantity, 0),
      );
      const discount = num(body.discount || 0, "Remise");
      if (discount > 0 && !can(user, "pos", "edit"))
        fail("Vous n’êtes pas autorisé à appliquer une remise.", 403);
      if (discount > subtotal) fail("La remise dépasse le sous-total.");
      const total = round(subtotal - discount);
      const payment = ["Espèces", "Carte bancaire", "Autre"].includes(
        body.payment,
      )
        ? body.payment
        : "Espèces";
      const received = pending
        ? 0
        : payment === "Espèces"
          ? num(body.received, "Montant reçu")
          : total;
      if (!pending && received < total)
        fail("Le montant reçu est insuffisant.");
      const date = new Date().toISOString();
      const count = (
        await tx
          .select({ id: records.id })
          .from(records)
          .where(eq(records.kind, "order"))
      ).length;
      const order = {
        number: "DZ-" + String(count + 1).padStart(5, "0"),
        date,
        items,
        subtotal,
        discount,
        total,
        cogs: round(items.reduce((s, i) => s + (i.cost || 0) * i.quantity, 0)),
        payment,
        received,
        change: pending ? 0 : round(received - total),
        employeeId: user.id,
        employeeName: user.name,
        status: pending ? "En attente" : "Terminée",
        stockDeducted: !pending,
      };
      if (!pending) await moveStock(tx, order, id, user, -1);
      await tx.insert(records).values({ id, kind: "order", data: order });
      return { id, ...order };
    });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    if (!STATUSES.includes(body.status)) fail("Statut invalide.");
    const user = await authorize(
      "orders",
      body.status === "Annulée"
        ? "cancel"
        : body.status === "Terminée"
          ? "complete"
          : "edit",
    );
    const result = await db.transaction(async (tx) => {
      await lock(tx);
      const [row] = await tx
        .select()
        .from(records)
        .where(eq(records.id, String(body.id)));
      if (!row || row.kind !== "order") fail("Commande introuvable.", 404);
      if (row.version !== body.version)
        fail("Cette commande a été modifiée. Actualisez et réessayez.", 409);
      const order = row.data as unknown as Order;
      if (order.status === "Annulée")
        fail("Une commande annulée ne peut pas être réouverte.");
      if (order.status === "Terminée" && body.status !== "Annulée")
        fail("Une vente encaissée peut uniquement être remboursée.");
      await makeBackup(tx);
      const next = { ...row.data, status: body.status };
      if (body.status === "Terminée" && !order.stockDeducted) {
        await moveStock(tx, row.data, row.id, user, -1);
        Object.assign(next, {
          stockDeducted: true,
          date: new Date().toISOString(),
          received: order.total,
          change: 0,
        });
      }
      if (body.status === "Annulée" && order.stockDeducted) {
        await moveStock(tx, row.data, row.id, user, 1);
        Object.assign(next, { stockDeducted: false });
      }
      await tx
        .update(records)
        .set({ data: next, version: row.version + 1, updatedAt: new Date() })
        .where(eq(records.id, row.id));
      return { ok: true };
    });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
