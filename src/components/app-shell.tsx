"use client";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  LayoutDashboard,
  ShoppingBag,
  ClipboardList,
  Pizza,
  Layers3,
  Package,
  Wallet,
  ChartNoAxesCombined,
  Users,
  Settings,
  Sun,
  Moon,
  Search,
  Bell,
  ChevronDown,
  ArrowUpRight,
  LogOut,
  HelpCircle,
  Menu,
  X,
  Store,
  ShieldCheck,
  Check,
  Command,
  ArrowRight,
  RefreshCw,
  CheckCheck,
  Info,
  LockKeyhole,
  Eye,
  EyeOff,
} from "lucide-react";
import { AppContext, type EditorKind, type Draft } from "./context";
import { Modal, Badge } from "./ui";
import {
  EMPTY_STATE,
  PAGE_LABELS,
  PAGES,
  type Page,
  type State,
  type Order,
  type CartItem,
} from "@/lib/types";
import { printReceipt as printTicket } from "@/lib/printing";
import { Dashboard } from "./dashboard";
import { POS } from "./pos";
import { ManagementPage, OrdersPage } from "./management";
import { EntityEditor } from "./editors";
import { Reports, SettingsPage } from "./reports-settings";
const navIcons = {
  dashboard: LayoutDashboard,
  pos: ShoppingBag,
  orders: ClipboardList,
  products: Pizza,
  categories: Layers3,
  stock: Package,
  expenses: Wallet,
  reports: ChartNoAxesCombined,
  employees: Users,
  settings: Settings,
};
export function AppShell() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutKey, setCheckoutKey] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<State>(EMPTY_STATE);
  const [page, setPage] = useState<Page>("dashboard");
  const [theme, setTheme] = useState("dark");
  const [loading, setLoading] = useState(true);
  const [login, setLogin] = useState(false);
  const [editor, setEditor] = useState<{
    kind: EditorKind;
    item?: Draft;
  } | null>(null);
  const [deletion, setDeletion] = useState<{
    kind: EditorKind;
    item: Draft;
  } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: string } | null>(
    null,
  );
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const [globalSearch, setGlobalSearch] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [connection, setConnection] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchLock = useRef(false);
  const authPrompted = useRef(false);
  const lastUser = useRef<string | null>(null);
  const localTheme = useRef(false);
  const notify = useCallback((message: string, type = "success") => {
    setToast({ message, type });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const request = useCallback(
    async <T = Record<string, unknown>,>(
      url: string,
      body?: unknown,
      method = "POST",
    ): Promise<T> => {
      const response = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) setLogin(true);
        throw new Error(result.error || "La requête a échoué.");
      }
      return result;
    },
    [],
  );
  const refresh = useCallback(async () => {
    if (fetchLock.current) return;
    fetchLock.current = true;
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) throw new Error("Impossible de synchroniser les données.");
      const data = (await res.json()) as State;
      if (lastUser.current && lastUser.current !== data.user?.id) {
        setCart([]);
        setCheckoutKey(crypto.randomUUID());
      }
      lastUser.current = data.user?.id || null;
      setState(data);
      setConnection(true);
      if (!localTheme.current) {
        setTheme(data.settings.theme || "dark");
        localTheme.current = true;
      }
      if (!data.setup && !data.user && !authPrompted.current) {
        setLogin(true);
        authPrompted.current = true;
      }
      if (data.user) authPrompted.current = false;
    } catch {
      setConnection(false);
    } finally {
      setLoading(false);
      fetchLock.current = false;
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 8000);
    const focus = () => void refresh();
    window.addEventListener("focus", focus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", focus);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [refresh]);
  useEffect(() => {
    const saved = localStorage.getItem("dz-theme");
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      localTheme.current = true;
    }
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("dz-theme", theme);
  }, [theme]);
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setGlobalSearch("");
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const ensureAuth = () => {
    if (!state.user) {
      setLogin(true);
      return false;
    }
    return true;
  };
  const can = (action: string, target: Page = page) =>
    !state.user
      ? true
      : state.user.role === "Administrateur" ||
        (state.user.pages.includes(target) &&
          state.user.actions.includes(action));
  const navigate = (target: Page) => {
    if (state.user && !can("view", target)) {
      notify("Cette page ne fait pas partie de vos autorisations.", "error");
      return;
    }
    window.scrollTo({ top: 0, behavior: "auto" });
    setPage(target);
    setMobile(false);
    setGlobalSearch(null);
  };
  const edit = (kind: EditorKind, item?: Draft) => {
    if (ensureAuth()) setEditor({ kind, item });
  };
  const remove = (kind: EditorKind, item: Draft) => {
    if (ensureAuth()) setDeletion({ kind, item });
  };
  const deleteItem = async () => {
    if (!deletion) return;
    setPending(true);
    try {
      await request(
        deletion.kind === "employee" ? "/api/employees" : "/api/entities",
        {
          kind: deletion.kind,
          id: deletion.item.id,
          version: deletion.item.version,
        },
        "DELETE",
      );
      setDeletion(null);
      notify("Élément supprimé.");
      await refresh();
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setPending(false);
    }
  };
  const printReceipt = (order: Order) => {
    try {
      printTicket(order, state.settings);
    } catch (e) {
      notify((e as Error).message, "error");
    }
  };
  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const user = state.user;
  const initials = user
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
    : "DZ";
  const lowStock = state.stock.filter((s) => s.quantity <= s.min);
  const waiting = state.orders.filter(
    (o) => !["Terminée", "Annulée"].includes(o.status),
  );
  const availablePages = PAGES.filter((p) => !user || can("view", p));
  const actualPage = availablePages.includes(page) ? page : null;
  const searchResults = useMemo(() => {
    if (globalSearch === null) return [];
    const q = globalSearch.toLowerCase();
    return [
      ...availablePages
        .filter((p) => PAGE_LABELS[p].toLowerCase().includes(q))
        .map((p) => ({ label: PAGE_LABELS[p], type: "Page", page: p })),
      ...state.products
        .filter((p) => p.name.toLowerCase().includes(q))
        .map((p) => ({
          label: p.name,
          type: "Produit",
          page: "products" as Page,
        })),
      ...state.orders
        .filter((o) => o.number.toLowerCase().includes(q))
        .map((o) => ({
          label: o.number,
          type: "Commande",
          page: "orders" as Page,
        })),
    ].slice(0, 12);
  }, [globalSearch, state.products, state.orders, availablePages]);
  return (
    <AppContext.Provider
      value={{
        cart,
        setCart,
        checkoutKey,
        newCheckoutKey: () => setCheckoutKey(crypto.randomUUID()),
        state,
        page,
        navigate,
        refresh,
        request,
        notify,
        ensureAuth,
        can,
        edit,
        remove,
        printReceipt,
        theme,
        toggleTheme,
        openLogin: () => setLogin(true),
        user,
      }}
    >
      <div className={`app ${mobile ? "mobile-nav-open" : ""}`}>
        <aside className="sidebar">
          <button
            className="brand"
            onClick={() => navigate("dashboard")}
            aria-label="Accueil DZ Legends Pizza"
          >
            <span className="brand-mark">
              {state.settings.logo ? (
                <img
                  src={state.settings.logo}
                  alt="Logo de la pizzeria"
                  style={{
                    width: 29,
                    height: 29,
                    objectFit: "contain",
                    borderRadius: 4,
                  }}
                />
              ) : (
                <Pizza size={29} strokeWidth={1.65} />
              )}
            </span>
            <span>
              <strong>
                DZ LEGENDS<span className="brand-dot">®</span>
              </strong>
              <small>P I Z Z A</small>
            </span>
          </button>
          <div className="workspace-label">
            <span>ESPACE DE GESTION</span>
            <span className="workspace-line" />
          </div>
          <nav>
            {availablePages
              .filter((p) => !["employees", "settings"].includes(p))
              .map((p) => {
                const Icon = navIcons[p];
                return (
                  <button
                    key={p}
                    className={`nav-item ${page === p ? "active" : ""}`}
                    onClick={() => navigate(p)}
                  >
                    <Icon size={19} />
                    <span>{PAGE_LABELS[p]}</span>
                    {p === "orders" && waiting.length > 0 ? (
                      <span className="nav-count">{waiting.length}</span>
                    ) : page === p ? (
                      <span className="nav-active-dot" />
                    ) : null}
                  </button>
                );
              })}
            <div className="nav-divider" />
            <div className="workspace-label administration-label">
              ADMINISTRATION
            </div>
            {availablePages
              .filter((p) => ["employees", "settings"].includes(p))
              .map((p) => {
                const Icon = navIcons[p];
                return (
                  <button
                    key={p}
                    className={`nav-item ${page === p ? "active" : ""}`}
                    onClick={() => navigate(p)}
                  >
                    <Icon size={19} />
                    <span>{PAGE_LABELS[p]}</span>
                    {page === p && <span className="nav-active-dot" />}
                  </button>
                );
              })}
          </nav>
          <div className="sidebar-bottom">
            <div className="sidebar-note">
              <span className="sidebar-note-icon">
                <ShieldCheck size={20} />
              </span>
              <strong>Votre pizzeria. Vos données.</strong>
              <p>
                Un espace privé, une gestion
                <br />
                en toute sérénité.
              </p>
              <span className="secure-note">
                <span />
                Stockage partagé sécurisé
              </span>
            </div>
            <button className="help-link" onClick={() => setHelp(true)}>
              <HelpCircle size={18} />
              <span>Besoin d’un coup de main ?</span>
              <ArrowUpRight size={15} />
            </button>
            <div className="sidebar-version">
              <span>DZ LEGENDS PIZZA</span>
              <span>v1.0</span>
            </div>
          </div>
        </aside>
        {mobile && (
          <button
            className="sidebar-shade"
            onClick={() => setMobile(false)}
            aria-label="Fermer le menu"
          />
        )}
        <div className="main-wrapper">
          <header className="header">
            <div className="header-left">
              <button
                className="icon-button mobile-toggle"
                onClick={() => setMobile(!mobile)}
                aria-label="Ouvrir le menu"
              >
                <Menu size={21} />
              </button>
              <span className="breadcrumb">Gestion de la pizzeria</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{PAGE_LABELS[page]}</strong>
            </div>
            <div className="header-right">
              <button
                className="header-search"
                onClick={() => setGlobalSearch("")}
                aria-label="Recherche globale"
              >
                <Search size={18} />
                <span>Rechercher</span>
                <kbd>⌘ K</kbd>
              </button>
              <div className="header-divider" />
              <button
                className="icon-button theme-button"
                onClick={toggleTheme}
                title={
                  theme === "dark"
                    ? "Passer au mode clair"
                    : "Passer au mode sombre"
                }
                aria-label="Changer de thème"
              >
                {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <div className="notification-container">
                <button
                  className={`icon-button ${notifications ? "selected" : ""}`}
                  onClick={() => setNotifications(!notifications)}
                  aria-label="Notifications"
                >
                  <Bell size={19} />
                  {lowStock.length + waiting.length > 0 && (
                    <span className="notification-dot" />
                  )}
                </button>
                {notifications && (
                  <div className="notification-popover">
                    <h3>
                      Votre activité{" "}
                      <span>{lowStock.length + waiting.length}</span>
                    </h3>
                    {!lowStock.length && !waiting.length ? (
                      <div className="notification-empty">
                        <CheckCheck size={27} />
                        <strong>Tout est à jour</strong>
                        <p>Aucune alerte pour le moment.</p>
                      </div>
                    ) : (
                      <>
                        {lowStock.map((s) => (
                          <button
                            key={s.id}
                            onClick={() => {
                              navigate("stock");
                              setNotifications(false);
                            }}
                          >
                            <Package size={18} />
                            <span>
                              <strong>{s.name}</strong>
                              <small>
                                Stock faible · {s.quantity} {s.unit}
                              </small>
                            </span>
                            <ArrowUpRight size={14} />
                          </button>
                        ))}
                        {waiting.slice(0, 5).map((o) => (
                          <button
                            key={o.id}
                            onClick={() => {
                              navigate("orders");
                              setNotifications(false);
                            }}
                          >
                            <ClipboardList size={18} />
                            <span>
                              <strong>{o.number}</strong>
                              <small>{o.status}</small>
                            </span>
                            <ArrowUpRight size={14} />
                          </button>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </div>
              <div className="header-divider" />
              <button
                className="profile-button"
                onClick={() => (user ? setHelp(true) : setLogin(true))}
              >
                <span className="avatar">{initials}</span>
                <span className="profile-details">
                  <strong>{user?.name || "Espace propriétaire"}</strong>
                  <small>{user?.role || "Configurez votre compte"}</small>
                </span>
                <ChevronDown size={15} />
              </button>
              {user && (
                <button
                  className="icon-button logout-button"
                  title="Se déconnecter"
                  onClick={async () => {
                    try {
                      await request("/api/auth", { action: "logout" });
                      await refresh();
                      notify("Vous êtes déconnecté.");
                    } catch (e) {
                      notify((e as Error).message, "error");
                    }
                  }}
                >
                  <LogOut size={17} />
                </button>
              )}
            </div>
          </header>
          <main className={`main-content ${page === "pos" ? "pos-main" : ""}`}>
            <div className="top-status">
              <span>
                <i className={connection ? "online-dot" : "offline-dot"} />
                {connection
                  ? "Votre espace, parfaitement synchronisé"
                  : "Connexion interrompue — réessai automatique"}
              </span>
              <span>
                <Store size={13} />
                Établissement privé <span className="status-separator">
                  ·
                </span>{" "}
                Algérie
              </span>
            </div>
            {!connection && (
              <div className="connection-warning">
                <Info size={17} />
                Les données affichées peuvent ne plus être à jour.
                <button onClick={() => void refresh()}>
                  <RefreshCw size={14} />
                  Réessayer
                </button>
              </div>
            )}
            {loading && <div className="loading-progress" />}
            {actualPage === "dashboard" ? (
              <Dashboard />
            ) : actualPage === "pos" ? (
              <POS />
            ) : actualPage === "orders" ? (
              <OrdersPage />
            ) : actualPage === "reports" ? (
              <Reports />
            ) : actualPage === "settings" ? (
              <SettingsPage />
            ) : actualPage ? (
              <ManagementPage
                key={actualPage}
                kind={
                  actualPage as
                    | "products"
                    | "categories"
                    | "stock"
                    | "expenses"
                    | "employees"
                }
              />
            ) : (
              <div className="access-denied">
                <LockKeyhole size={42} />
                <h2>Accès limité</h2>
                <p>Sélectionnez une page autorisée dans le menu.</p>
              </div>
            )}
            <footer className="main-footer">
              <span>Conçu pour les belles journées de service.</span>
              <span>
                <span className="footer-dot" />
                DZ Legends Pizza <span className="footer-separator">
                  /
                </span>{" "}
                Gestion & Caisse
              </span>
            </footer>
          </main>
        </div>
      </div>
      {editor && (
        <EntityEditor
          kind={editor.kind}
          item={editor.item}
          onClose={() => setEditor(null)}
        />
      )}
      {deletion && (
        <Modal
          title="Supprimer cet élément ?"
          subtitle="Cette action est définitive. Les ventes passées conserveront leurs informations."
          onClose={() => !pending && setDeletion(null)}
          busy={pending}
        >
          <div className="confirmation-body">
            <div className="confirmation-icon">
              <X size={26} />
            </div>
            <p>
              Voulez-vous supprimer{" "}
              <strong>
                {String(deletion.item.name || deletion.item.description)}
              </strong>{" "}
              ?
            </p>
          </div>
          <div className="modal-footer">
            <button
              className="button button-secondary"
              onClick={() => setDeletion(null)}
              disabled={pending}
            >
              Conserver
            </button>
            <button
              className="button button-danger"
              onClick={() => void deleteItem()}
              disabled={pending}
            >
              {pending ? "Suppression…" : "Oui, supprimer"}
            </button>
          </div>
        </Modal>
      )}
      {login && (
        <AuthModal
          setup={state.setup}
          onClose={() => setLogin(false)}
          onSuccess={async () => {
            await refresh();
            setLogin(false);
            notify(
              state.setup
                ? "Bienvenue ! Votre compte administrateur est prêt."
                : "Heureux de vous retrouver.",
            );
          }}
          request={request}
        />
      )}
      {help && (
        <Modal
          title={user ? "Votre espace de travail" : "Un coup de main ?"}
          subtitle="DZ Legends Pizza · Gestion & Caisse"
          onClose={() => setHelp(false)}
        >
          <div className="help-content">
            {user && (
              <div className="help-account">
                <span className="avatar">{initials}</span>
                <div>
                  <strong>{user.name}</strong>
                  <p>
                    {user.role} · @{user.username}
                  </p>
                </div>
                <Badge tone="green">Connecté</Badge>
              </div>
            )}
            <h3>Votre premier service, en 4 étapes</h3>
            {[
              [
                "1",
                "Configurez votre établissement",
                "Nom, coordonnées et format du ticket dans Paramètres.",
              ],
              [
                "2",
                "Créez votre carte",
                "Ajoutez vos catégories, vos produits et leurs photos.",
              ],
              [
                "3",
                "Préparez votre stock",
                "Renseignez les ingrédients et reliez-les à vos recettes.",
              ],
              [
                "4",
                "Ouvrez votre caisse",
                "Encaissez et retrouvez vos ventes dans les rapports.",
              ],
            ].map(([n, t, d]) => (
              <div className="help-step" key={n}>
                <span>{n}</span>
                <div>
                  <strong>{t}</strong>
                  <p>{d}</p>
                </div>
              </div>
            ))}
            <div className="info-box">
              <ShieldCheck size={18} />
              <span>
                Les données métier sont stockées sur le serveur partagé, jamais
                dans le stockage de votre navigateur.
              </span>
            </div>
          </div>
          <div className="modal-footer">
            <button
              className="button button-primary"
              onClick={() => setHelp(false)}
            >
              C’est compris
              <Check size={16} />
            </button>
          </div>
        </Modal>
      )}
      {globalSearch !== null && (
        <Modal
          title="Que recherchez-vous ?"
          subtitle="Retrouvez une page, un produit ou une commande."
          onClose={() => setGlobalSearch(null)}
        >
          <div className="global-search-input">
            <Search size={20} />
            <input
              autoFocus
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Rechercher dans votre espace…"
            />
          </div>
          <div className="search-results">
            {searchResults.map((r, i) => (
              <button key={i} onClick={() => navigate(r.page)}>
                <span className="search-result-icon">
                  {r.type === "Page" ? (
                    <Command size={18} />
                  ) : r.type === "Produit" ? (
                    <Pizza size={18} />
                  ) : (
                    <ClipboardList size={18} />
                  )}
                </span>
                <span>
                  <strong>{r.label}</strong>
                  <small>{r.type}</small>
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
            {!searchResults.length && (
              <p className="search-no-results">
                Aucun résultat pour « {globalSearch} ».
              </p>
            )}
          </div>
        </Modal>
      )}
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          <span>
            {toast.type === "error" ? <Info size={19} /> : <Check size={19} />}
          </span>
          {toast.message}
          <button onClick={() => setToast(null)} aria-label="Fermer">
            <X size={15} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
function AuthModal({
  setup,
  onClose,
  onSuccess,
  request,
}: {
  setup: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  request: <T = Record<string, unknown>>(
    url: string,
    body?: unknown,
    method?: string,
  ) => Promise<T>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [show, setShow] = useState(false);
  return (
    <Modal
      title={
        setup ? "Votre légende commence ici." : "Heureux de vous retrouver."
      }
      subtitle={
        setup
          ? "Créez votre compte propriétaire pour commencer. Aucun identifiant prédéfini."
          : "Connectez-vous à votre espace de gestion privé."
      }
      onClose={onClose}
      busy={busy}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            await request("/api/auth", {
              action: setup ? "setup" : "login",
              name: f.get("name"),
              username: f.get("username"),
              password: f.get("password"),
            });
            await onSuccess();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="auth-body">
          <div className="auth-emblem">
            <Pizza size={36} />
            <span>ESPACE SÉCURISÉ</span>
          </div>
          {setup && (
            <label className="field">
              <span>Votre nom complet</span>
              <input
                name="name"
                required
                autoComplete="name"
                placeholder="Ex. Amine Benali"
                maxLength={180}
              />
            </label>
          )}
          <label className="field">
            <span>Identifiant</span>
            <input
              name="username"
              required
              autoComplete="username"
              placeholder="Votre identifiant"
              pattern="[A-Za-z0-9._-]+"
              maxLength={60}
            />
          </label>
          <label className="field">
            <span>Mot de passe</span>
            <div className="password-field">
              <input
                name="password"
                required
                type={show ? "text" : "password"}
                minLength={setup ? 10 : 1}
                maxLength={128}
                autoComplete={setup ? "new-password" : "current-password"}
                placeholder={
                  setup ? "Au moins 10 caractères" : "Votre mot de passe"
                }
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label="Afficher le mot de passe"
              >
                {show ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>
          {error && (
            <div className="form-error">
              <Info size={16} />
              {error}
            </div>
          )}
          <div className="auth-security">
            <LockKeyhole size={14} />
            <span>Mot de passe haché · Session privée de 12 heures</span>
          </div>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={onClose}
          >
            Plus tard
          </button>
          <button className="button button-primary" disabled={busy}>
            {busy ? "Un instant…" : setup ? "Créer mon espace" : "Se connecter"}
            <ArrowRight size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
