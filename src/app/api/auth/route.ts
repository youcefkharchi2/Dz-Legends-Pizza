import { db } from "@/db";
import { employees, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hash, compare } from "bcryptjs";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import {
  allPermissions,
  checkOrigin,
  errorResponse,
  fail,
  lock,
  newSession,
  safeUser,
  text,
} from "@/lib/server";
export const runtime = "nodejs";
const attempts = new Map<string, { count: number; until: number }>();
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const body = await request.json();
    if (body.action === "logout") {
      const jar = await cookies();
      const token = jar.get("dz_session")?.value;
      if (token)
        await db
          .delete(sessions)
          .where(
            eq(
              sessions.token,
              createHash("sha256").update(token).digest("hex"),
            ),
          );
      jar.delete("dz_session");
      return Response.json({ ok: true });
    }
    const username = text(body.username, "Identifiant", 60).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!password || password.length > 128) fail("Mot de passe invalide.");
    let user;
    if (body.action === "setup") {
      if (password.length < 10)
        fail("Choisissez un mot de passe d’au moins 10 caractères.");
      if (!/^[a-z0-9._-]+$/.test(username))
        fail("Identifiant : lettres, chiffres, points et tirets uniquement.");
      const name = text(body.name, "Nom complet");
      const passwordHash = await hash(password, 12);
      user = await db.transaction(async (tx) => {
        await lock(tx);
        const existing = await tx
          .select({ id: employees.id })
          .from(employees)
          .limit(1);
        if (existing.length)
          fail("Le logiciel est déjà configuré. Connectez-vous.", 409);
        const [created] = await tx
          .insert(employees)
          .values({
            id: crypto.randomUUID(),
            name,
            username,
            passwordHash,
            role: "Administrateur",
            isOwner: true,
            ...allPermissions,
          })
          .returning();
        return created;
      });
    } else if (body.action === "login") {
      const key =
        (request.headers.get("x-forwarded-for") || "local") + ":" + username;
      const entry = attempts.get(key);
      if (entry && entry.until > Date.now() && entry.count >= 6)
        fail("Trop de tentatives. Réessayez dans 15 minutes.", 429);
      const [found] = await db
        .select()
        .from(employees)
        .where(eq(employees.username, username));
      if (
        !found ||
        !found.active ||
        !(await compare(password, found.passwordHash))
      ) {
        attempts.set(key, {
          count: entry && entry.until > Date.now() ? entry.count + 1 : 1,
          until: Date.now() + 900000,
        });
        fail("Identifiant ou mot de passe incorrect.", 401);
      }
      attempts.delete(key);
      user = found;
    } else fail("Action non reconnue.");
    await newSession(user.id, request);
    return Response.json({ user: safeUser(user) });
  } catch (e) {
    return errorResponse(e);
  }
}
