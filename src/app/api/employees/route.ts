import { db } from "@/db";
import { employees, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hash } from "bcryptjs";
import {
  admin,
  allPermissions,
  checkOrigin,
  errorResponse,
  fail,
  lock,
  makeBackup,
  text,
} from "@/lib/server";
import { PAGES, ACTIONS } from "@/lib/types";
async function handle(request: Request) {
  try {
    checkOrigin(request);
    const user = await admin();
    const body = await request.json();
    await db.transaction(async (tx) => {
      await lock(tx);
      await makeBackup(tx);
      const [old] = body.id
        ? await tx.select().from(employees).where(eq(employees.id, body.id))
        : [];
      if (request.method !== "POST" && !old) fail("Employé introuvable.", 404);
      if (request.method === "DELETE") {
        if (old.isOwner || old.id === user.id)
          fail(
            "Le compte propriétaire et votre propre compte ne peuvent pas être supprimés.",
          );
        await tx.delete(employees).where(eq(employees.id, old.id));
        return;
      }
      const data = body.data || {};
      const name = text(data.name, "Nom complet");
      const username = text(data.username, "Identifiant", 60).toLowerCase();
      if (!/^[a-z0-9._-]+$/.test(username))
        fail("Identifiant : lettres, chiffres, points et tirets uniquement.");
      const [duplicate] = await tx
        .select()
        .from(employees)
        .where(eq(employees.username, username));
      if (duplicate && duplicate.id !== old?.id)
        fail("Cet identifiant est déjà utilisé.", 409);
      const role = [
        "Administrateur",
        "Manager",
        "Caissier",
        "Personnalisé",
      ].includes(data.role)
        ? data.role
        : "Caissier";
      if (old?.isOwner && (role !== "Administrateur" || data.active === false))
        fail("Le propriétaire doit rester administrateur actif.");
      if (old?.id === user.id && data.active === false)
        fail("Vous ne pouvez pas désactiver votre propre compte.");
      let passwordHash = old?.passwordHash;
      if (data.password) {
        if (String(data.password).length < 10)
          fail("Le mot de passe doit contenir au moins 10 caractères.");
        passwordHash = await hash(String(data.password), 12);
      }
      if (!passwordHash) fail("Un mot de passe est obligatoire.");
      const values = {
        name,
        username,
        passwordHash,
        role,
        active: data.active !== false,
        pages:
          role === "Administrateur"
            ? allPermissions.pages
            : Array.isArray(data.pages)
              ? data.pages.filter((p: string) => PAGES.includes(p as never))
              : [],
        actions:
          role === "Administrateur"
            ? allPermissions.actions
            : Array.isArray(data.actions)
              ? data.actions.filter((p: string) => ACTIONS.includes(p as never))
              : [],
      };
      if (old) {
        await tx.update(employees).set(values).where(eq(employees.id, old.id));
        await tx.delete(sessions).where(eq(sessions.employeeId, old.id));
      } else
        await tx
          .insert(employees)
          .values({ id: crypto.randomUUID(), ...values });
    });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export const POST = handle;
export const PUT = handle;
export const DELETE = handle;
