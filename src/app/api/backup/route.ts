import { validateBackup } from "@/lib/backup-validation";
import { db } from "@/db";
import {
  records,
  employees,
  uploads,
  settings,
  sessions,
  backups,
} from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  admin,
  checkOrigin,
  errorResponse,
  fail,
  lock,
  makeBackup,
  snapshot,
} from "@/lib/server";
export async function GET(request: Request) {
  try {
    await admin();
    if (new URL(request.url).searchParams.get("automatic") === "true") {
      const [row] = await db
        .select()
        .from(backups)
        .orderBy(desc(backups.createdAt))
        .limit(1);
      if (!row) fail("Aucune sauvegarde automatique disponible.", 404);
      return Response.json(row.data, {
        headers: {
          "Content-Disposition": `attachment; filename="DZ-Legends-auto-${row.createdAt.toISOString().slice(0, 10)}.json"`,
        },
      });
    }
    const data = await db.transaction(async (tx) => {
      await lock(tx);
      return snapshot(tx);
    });
    return Response.json(data, {
      headers: {
        "Content-Disposition": `attachment; filename="DZ-Legends-${new Date().toISOString().replace(/[:.]/g, "-")}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await admin();
    const body = await request.json();
    if (!["reset", "restore"].includes(body.action)) fail("Action inconnue.");
    if (body.action === "reset" && body.confirmation !== "RÉINITIALISER")
      fail("Saisissez exactement RÉINITIALISER pour confirmer.");
    const data = body.backup;
    if (body.action === "restore") {
      if (body.confirmation !== "RESTAURER")
        fail("Saisissez exactement RESTAURER pour confirmer.");
      validateBackup(data);
      if (
        data?.format !== "dz-legends-v1" ||
        !Array.isArray(data.records) ||
        !Array.isArray(data.uploads) ||
        !Array.isArray(data.employees) ||
        !Array.isArray(data.settings)
      )
        fail("Fichier de sauvegarde non reconnu.");
      if (JSON.stringify(data).length > 80 * 1024 * 1024)
        fail("Sauvegarde trop volumineuse (80 Mo maximum).");
      const ids = new Set();
      for (const r of data.records) {
        if (
          !r.id ||
          ids.has(r.id) ||
          ![
            "product",
            "category",
            "stock",
            "expense",
            "order",
            "movement",
          ].includes(r.kind) ||
          !r.data ||
          typeof r.data !== "object"
        )
          fail("Données de sauvegarde invalides.");
        ids.add(r.id);
      }
      for (const f of data.uploads)
        if (
          !f.id ||
          !["image/png", "image/jpeg", "image/webp"].includes(f.mime) ||
          typeof f.content !== "string"
        )
          fail("Image de sauvegarde invalide.");
      for (const e of data.employees)
        if (
          !e.id ||
          !e.username ||
          !e.name ||
          typeof e.passwordHash !== "string" ||
          !/^\$2[aby]\$/.test(e.passwordHash) ||
          !Array.isArray(e.pages) ||
          !Array.isArray(e.actions)
        )
          fail("Compte de sauvegarde invalide.");
    }
    await db.transaction(async (tx) => {
      await lock(tx);
      await makeBackup(tx, true);
      const keep = await tx.select().from(employees);
      await tx.delete(records);
      await tx.delete(uploads);
      await tx.delete(settings);
      for (const e of keep)
        if (!e.isOwner && e.id !== user.id)
          await tx.delete(employees).where(eq(employees.id, e.id));
      if (body.action === "reset") {
        for (const e of keep)
          if (!e.isOwner && e.id === user.id)
            await tx.delete(employees).where(eq(employees.id, e.id));
        return;
      }
      for (const r of data.records)
        await tx
          .insert(records)
          .values({
            id: r.id,
            kind: r.kind,
            data: r.data,
            version: Number(r.version) || 1,
            createdAt: new Date(r.createdAt || Date.now()),
            updatedAt: new Date(r.updatedAt || Date.now()),
          });
      for (const f of data.uploads)
        await tx
          .insert(uploads)
          .values({
            id: f.id,
            name: String(f.name || "image"),
            mime: f.mime,
            content: f.content,
          });
      for (const s of data.settings)
        if (s.id === "main")
          await tx.insert(settings).values({ id: "main", data: s.data });
      const preserved = keep.filter((e) => e.isOwner || e.id === user.id);
      for (const e of data.employees)
        if (!preserved.some((p) => p.id === e.id || p.username === e.username))
          await tx
            .insert(employees)
            .values({
              id: e.id,
              name: e.name,
              username: e.username,
              passwordHash: e.passwordHash,
              role: e.role,
              active: e.active !== false,
              isOwner: false,
              pages: e.pages,
              actions: e.actions,
            });
      for (const e of keep)
        if (e.id !== user.id)
          await tx.delete(sessions).where(eq(sessions.employeeId, e.id));
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
