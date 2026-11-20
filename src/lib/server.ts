import { db } from "@/db";
import {
  employees,
  sessions,
  records,
  settings,
  uploads,
  backups,
} from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { DEFAULT_SETTINGS, PAGES, ACTIONS, type User } from "./types";
export type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function fail(message: string, status = 400): never {
  throw new AppError(message, status);
}
export function errorResponse(error: unknown) {
  console.error(error instanceof AppError ? error.message : error);
  return Response.json(
    {
      error:
        error instanceof AppError
          ? error.message
          : "Une erreur est survenue. Réessayez dans un instant.",
    },
    { status: error instanceof AppError ? error.status : 500 },
  );
}
export const safeUser = (user: typeof employees.$inferSelect): User => ({
  id: user.id,
  name: user.name,
  username: user.username,
  role: user.role,
  active: user.active,
  isOwner: user.isOwner,
  pages: user.pages,
  actions: user.actions,
});
export const isAdmin = (user: User) => user.role === "Administrateur";
export function can(user: User, page: string, action = "view") {
  return (
    isAdmin(user) ||
    (user.pages.includes(page) && user.actions.includes(action))
  );
}
export async function currentUser() {
  const token = (await cookies()).get("dz_session")?.value;
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const [row] = await db
    .select({ user: employees, expires: sessions.expiresAt })
    .from(sessions)
    .innerJoin(employees, eq(sessions.employeeId, employees.id))
    .where(eq(sessions.token, hash));
  if (!row || row.expires < new Date() || !row.user.active) return null;
  return safeUser(row.user);
}
export async function authorize(page: string, action = "view") {
  const user = await currentUser();
  if (!user) fail("Connectez-vous pour continuer.", 401);
  if (!can(user, page, action))
    fail("Vous ne disposez pas de cette autorisation.", 403);
  return user;
}
export async function admin() {
  const user = await authorize("employees");
  if (!isAdmin(user))
    fail("Cette action est réservée aux administrateurs.", 403);
  return user;
}
export async function newSession(id: string, request: Request) {
  const token = randomBytes(32).toString("hex");
  await db
    .insert(sessions)
    .values({
      token: createHash("sha256").update(token).digest("hex"),
      employeeId: id,
      expiresAt: new Date(Date.now() + 12 * 3600_000),
    });
  (await cookies()).set("dz_session", token, {
    httpOnly: true,
    sameSite: "strict",
    secure: new URL(request.url).protocol === "https:",
    path: "/",
    maxAge: 43200,
  });
}
export async function lock(tx: Transaction) {
  await tx.execute(sql`select pg_advisory_xact_lock(72918462)`);
}
export async function getSettings(tx: typeof db | Transaction = db) {
  const [row] = await tx.select().from(settings).where(eq(settings.id, "main"));
  return { ...DEFAULT_SETTINGS, ...row?.data };
}
export async function snapshot(tx: typeof db | Transaction = db) {
  return {
    format: "dz-legends-v1",
    exportedAt: new Date().toISOString(),
    records: await tx.select().from(records),
    employees: await tx.select().from(employees),
    settings: await tx.select().from(settings),
    uploads: await tx.select().from(uploads),
  };
}
export async function makeBackup(tx: Transaction, force = false) {
  const config = await getSettings(tx);
  if (!force && !config.autoBackup) return;
  const [last] = await tx
    .select()
    .from(backups)
    .orderBy(desc(backups.createdAt))
    .limit(1);
  if (
    !force &&
    last &&
    last.createdAt.toISOString().slice(0, 10) ===
      new Date().toISOString().slice(0, 10)
  )
    return;
  await tx
    .insert(backups)
    .values({ id: crypto.randomUUID(), data: await snapshot(tx) });
  const old = await tx
    .select({ id: backups.id })
    .from(backups)
    .orderBy(desc(backups.createdAt))
    .offset(14);
  for (const row of old) await tx.delete(backups).where(eq(backups.id, row.id));
}
export function text(v: unknown, label: string, max = 180) {
  if (typeof v !== "string" || !v.trim() || v.trim().length > max)
    fail(`${label} : renseignez une valeur valide.`);
  return v.trim();
}
export function num(v: unknown, label: string, min = 0) {
  const n = Number(v);
  if (
    (typeof v !== "string" && typeof v !== "number") ||
    v === "" ||
    v === null ||
    v === undefined ||
    !Number.isFinite(n) ||
    n < min ||
    n > 1e12
  )
    fail(`${label} : nombre invalide.`);
  return n;
}
export const round = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100;
export const allPermissions = { pages: [...PAGES], actions: [...ACTIONS] };
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !== request.headers.get("host") &&
    new URL(origin).host !== request.headers.get("x-forwarded-host")
  )
    fail("Origine de la requête non autorisée.", 403);
}
