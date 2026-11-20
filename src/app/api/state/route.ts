import { db } from "@/db";
import { records, employees, backups } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
  can,
  currentUser,
  errorResponse,
  getSettings,
  isAdmin,
  safeUser,
} from "@/lib/server";
import {
  EMPTY_STATE,
  type Product,
  type Category,
  type StockItem,
  type Expense,
  type Order,
  type Movement,
} from "@/lib/types";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const user = await currentUser();
    const [first] = await db
      .select({ id: employees.id })
      .from(employees)
      .limit(1);
    const config = await getSettings();
    if (!user)
      return Response.json(
        {
          ...EMPTY_STATE,
          settings: {
            ...EMPTY_STATE.settings,
            name: config.name,
            logo: config.logo,
          },
          setup: !first,
          lastSync: new Date().toISOString(),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    const rows = await db
      .select()
      .from(records)
      .orderBy(desc(records.createdAt));
    const finance = isAdmin(user) || user.actions.includes("finance");
    const visible = (page: string) => can(user, page);
    const select = <T>(kind: string): T[] =>
      rows
        .filter((r) => r.kind === kind)
        .map((r) => ({
          ...r.data,
          id: r.id,
          version: r.version,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        })) as T[];
    const [last] = await db
      .select({ date: backups.createdAt })
      .from(backups)
      .orderBy(desc(backups.createdAt))
      .limit(1);
    const result = {
      setup: false,
      user,
      settings: config,
      lastSync: new Date().toISOString(),
      lastBackup: last?.date.toISOString() || null,
      products:
        visible("products") ||
        visible("pos") ||
        visible("dashboard") ||
        visible("reports")
          ? select<Product>("product").map((p) =>
              finance
                ? p
                : {
                    ...p,
                    cost: 0,
                    sizes: p.sizes.map((s) => ({ ...s, cost: 0 })),
                    extras: p.extras.map((e) => ({ ...e, cost: 0 })),
                  },
            )
          : [],
      categories:
        visible("categories") ||
        visible("products") ||
        visible("pos") ||
        visible("reports")
          ? select<Category>("category")
          : [],
      stock:
        visible("stock") || visible("products") || visible("dashboard")
          ? select<StockItem>("stock").map((s) =>
              finance ? s : { ...s, cost: 0 },
            )
          : [],
      expenses:
        finance &&
        (visible("expenses") || visible("dashboard") || visible("reports"))
          ? select<Expense>("expense")
          : [],
      orders:
        visible("orders") ||
        visible("dashboard") ||
        visible("reports") ||
        visible("pos")
          ? select<Order>("order").map((o) =>
              finance
                ? o
                : {
                    ...o,
                    cogs: 0,
                    items: o.items.map((i) => ({ ...i, cost: 0 })),
                  },
            )
          : [],
      movements:
        visible("stock") || visible("reports")
          ? select<Movement & { purchaseTotal?: number }>("movement").map(
              (m) => (finance ? m : { ...m, purchaseTotal: 0 }),
            )
          : [],
      employees: isAdmin(user)
        ? (await db.select().from(employees)).map(safeUser)
        : [],
    };
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}
