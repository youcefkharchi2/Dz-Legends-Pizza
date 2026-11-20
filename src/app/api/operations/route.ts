import { db } from "@/db";
import { records, settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  authorize,
  checkOrigin,
  errorResponse,
  fail,
  getSettings,
  lock,
  makeBackup,
  num,
  text,
} from "@/lib/server";
import { DEFAULT_SETTINGS } from "@/lib/types";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    if (body.action === "settings") {
      await authorize("settings", "edit");
      const d = body.data || {};
      const value = {
        name: text(d.name, "Nom de la pizzeria"),
        address: String(d.address || "").slice(0, 400),
        phone: String(d.phone || "").slice(0, 50),
        currency: "DA",
        footer: String(d.footer || "").slice(0, 400),
        receiptWidth: d.receiptWidth === "58" ? "58" : "80",
        allowNegative: !!d.allowNegative,
        autoBackup: d.autoBackup !== false,
        logo:
          typeof d.logo === "string" &&
          /^\/api\/uploads\/[a-f0-9-]+$/.test(d.logo)
            ? d.logo
            : "",
        theme: d.theme === "light" ? "light" : "dark",
      };
      await db.transaction(async (tx) => {
        await lock(tx);
        await makeBackup(tx);
        await tx
          .insert(settings)
          .values({ id: "main", data: { ...DEFAULT_SETTINGS, ...value } })
          .onConflictDoUpdate({ target: settings.id, set: { data: value } });
      });
      return Response.json({ ok: true });
    }
    if (body.action === "movement") {
      const user = await authorize("stock", "edit");
      const quantity = num(body.quantity, "Quantité", 0.000001);
      const delta = body.direction === "out" ? -quantity : quantity;
      await db.transaction(async (tx) => {
        await lock(tx);
        const [row] = await tx
          .select()
          .from(records)
          .where(eq(records.id, String(body.stockId)));
        if (!row || row.kind !== "stock") fail("Article introuvable.", 404);
        if (body.version !== row.version)
          fail("Le stock a changé. Actualisez puis réessayez.", 409);
        const config = await getSettings(tx);
        const next =
          Math.round((Number(row.data.quantity) + delta) * 1e6) / 1e6;
        if (next < 0 && !config.allowNegative)
          fail("Stock insuffisant pour ce mouvement.");
        await makeBackup(tx);
        let cost = Number(row.data.cost);
        if (
          delta > 0 &&
          body.purchaseCost !== "" &&
          body.purchaseCost !== undefined
        ) {
          const unitCost = num(body.purchaseCost, "Coût d’achat");
          const oldQty = Math.max(0, Number(row.data.quantity));
          cost =
            next > 0
              ? (oldQty * cost + quantity * unitCost) / (oldQty + quantity)
              : unitCost;
        }
        await tx
          .update(records)
          .set({
            data: { ...row.data, quantity: next, cost },
            version: row.version + 1,
            updatedAt: new Date(),
          })
          .where(eq(records.id, row.id));
        await tx
          .insert(records)
          .values({
            id: crypto.randomUUID(),
            kind: "movement",
            data: {
              stockId: row.id,
              name: row.data.name,
              delta,
              unit: row.data.unit,
              reason: text(body.reason, "Motif"),
              date: new Date().toISOString(),
              employeeName: user.name,
              purchaseTotal: delta > 0 ? quantity * cost : 0,
            },
          });
      });
      return Response.json({ ok: true });
    }
    fail("Action inconnue.");
  } catch (e) {
    return errorResponse(e);
  }
}
