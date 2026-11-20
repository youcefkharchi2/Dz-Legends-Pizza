import "dotenv/config";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 3000);
const url = `http://127.0.0.1:${port}`;
const isWindows = process.platform === "win32";
const openBrowser = () => {
  if (isWindows)
    spawn("cmd.exe", ["/d", "/s", "/c", "start", '""', url], {
      stdio: "ignore",
      windowsHide: true,
    });
  else console.log(`Ouvrez ${url} dans votre navigateur.`);
};
async function healthy() {
  try {
    const r = await fetch(url + "/api/health", {
      signal: AbortSignal.timeout(1500),
    });
    return r.ok && (await r.json()).ok === true;
  } catch {
    return false;
  }
}
async function run(command, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      env: process.env,
      cwd: root,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Échec (${code}) : ${command} ${args.join(" ")}`)),
    );
  });
}
try {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT doit être un nombre entier compris entre 1 et 65535.");
  if (await healthy()) {
    console.log("DZ Legends Pizza est déjà ouvert.");
    openBrowser();
    process.exit(0);
  }
  if (!process.env.DATABASE_URL)
    throw new Error(
      "DATABASE_URL est absent de .env. Cette version utilise PostgreSQL (pas SQLite) : installez PostgreSQL, créez la base, puis configurez DATABASE_URL.",
    );
  if (!existsSync(resolve(root, "node_modules")))
    throw new Error(
      "Les dépendances sont absentes. Relancez Start DZ Legends Pizza.bat pour les installer.",
    );
  console.log("Vérification du schéma PostgreSQL…");
  await run(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "push"]);
  if (!existsSync(".next/BUILD_ID")) {
    console.log("Préparation de la version de production…");
    await run(process.execPath, ["node_modules/next/dist/bin/next", "build"]);
  }
  console.log("Démarrage de DZ Legends Pizza…");
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "-H",
      "127.0.0.1",
      "-p",
      String(port),
    ],
    { stdio: "inherit", env: process.env, cwd: root },
  );
  let exited = false;
  server.on("error", (e) => {
    console.error(e);
    exited = true;
  });
  server.on("exit", (code) => {
    exited = true;
    process.exit(code || 0);
  });
  for (let i = 0; i < 90; i++) {
    if (exited)
      throw new Error(
        "Le serveur s’est arrêté avant de devenir prêt. Vérifiez l’erreur affichée ci-dessus (PostgreSQL, .env ou port déjà utilisé).",
      );
    if (await healthy()) {
      console.log("Votre espace est prêt. Laissez cette fenêtre ouverte.");
      openBrowser();
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
    if (i === 89) {
      server.kill();
      throw new Error(
        `Le serveur n’a pas répondu à ${url}/api/health dans les 90 secondes.`,
      );
    }
  }
  process.on("SIGINT", () => server.kill());
  process.on("SIGTERM", () => server.kill());
} catch (error) {
  console.error("\n" + error.message);
  process.exit(1);
}
