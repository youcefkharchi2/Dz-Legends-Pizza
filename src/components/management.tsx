"use client";
import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Pizza,
  Layers3,
  Package,
  Wallet,
  Users,
  MoreHorizontal,
  Pencil,
  Trash2,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  ClipboardList,
  Printer,
  Search,
  Check,
  RotateCcw,
  Eye,
  Power,
  History,
  ShieldCheck,
  AlertTriangle,
  Download,
  CalendarDays,
} from "lucide-react";
import { useApp, type Draft, type EditorKind } from "./context";
import {
  Badge,
  Empty,
  Modal,
  SearchInput,
  SectionHeading,
  Select,
  statusTone,
} from "./ui";
import { PAGE_LABELS, STATUSES, money, dateKey, type Order } from "@/lib/types";
import { exportCSV } from "@/lib/printing";
type Kind = "products" | "categories" | "stock" | "expenses" | "employees";
const config = {
  products: {
    singular: "product" as EditorKind,
    icon: Pizza,
    title: "Votre carte, votre signature.",
    description: "Des produits bien pensés pour des clients bien servis.",
    add: "Ajouter un produit",
    empty: "Une carte pleine de possibilités",
    emptyText:
      "Ajoutez votre premier produit, son prix et une belle photo. La suite s’écrit en cuisine.",
  },
  categories: {
    singular: "category" as EditorKind,
    icon: Layers3,
    title: "Une carte bien organisée.",
    description: "Regroupez vos produits pour une caisse encore plus fluide.",
    add: "Créer une catégorie",
    empty: "Chaque spécialité trouvera sa place",
    emptyText: "Créez vos catégories et organisez votre carte à votre façon.",
  },
  stock: {
    singular: "stock" as EditorKind,
    icon: Package,
    title: "Les bons ingrédients, au bon moment.",
    description:
      "Suivez vos quantités, vos coûts et chaque mouvement de stock.",
    add: "Ajouter un ingrédient",
    empty: "Une cuisine bien approvisionnée commence ici",
    emptyText:
      "Ajoutez vos ingrédients, leurs unités et leurs seuils d’alerte.",
  },
  expenses: {
    singular: "expense" as EditorKind,
    icon: Wallet,
    title: "Gardez la main sur vos dépenses.",
    description:
      "Chaque charge enregistrée, une vision plus juste de votre rentabilité.",
    add: "Ajouter une dépense",
    empty: "Vos comptes commencent sur une page blanche",
    emptyText:
      "Enregistrez vos charges d’exploitation pour suivre votre bénéfice réel.",
  },
  employees: {
    singular: "employee" as EditorKind,
    icon: Users,
    title: "Une équipe qui fait la différence.",
    description:
      "Des comptes personnels et les bonnes permissions pour chacun.",
    add: "Ajouter un employé",
    empty: "Les grandes équipes commencent ici",
    emptyText:
      "Créez des comptes et attribuez à chacun les accès dont il a besoin.",
  },
};
export function ManagementPage({ kind }: { kind: Kind }) {
  const app = useApp();
  const { state, edit, remove, can } = app;
  const c = config[kind];
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("grid");
  const [tab, setTab] = useState("items");
  const [date, setDate] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const records = state[kind] as unknown as Draft[];
  const items = useMemo(
    () =>
      records
        .filter((item) => {
          const match = String(item.name || item.description || "")
            .toLowerCase()
            .includes(search.toLowerCase());
          if (!match) return false;
          if (kind === "products" && filter !== "all")
            return item.categoryId === filter;
          if (kind === "stock" && filter === "low")
            return item.quantity <= item.min;
          if (kind === "employees" && filter !== "all")
            return item.role === filter;
          if (
            kind === "expenses" &&
            filter !== "all" &&
            item.category !== filter
          )
            return false;
          if (kind === "expenses" && date && item.date !== date) return false;
          return true;
        })
        .sort((a, b) => (kind === "categories" ? a.order - b.order : 0)),
    [records, search, filter, kind, date],
  );
  useEffect(() => {
    const last = Math.max(1, Math.ceil(items.length / 12));
    if (pageNumber > last) setPageNumber(last);
  }, [items.length, pageNumber]);
  const shown = items.slice((pageNumber - 1) * 12, pageNumber * 12);
  const finance =
    !app.user ||
    app.user.role === "Administrateur" ||
    app.user.actions.includes("finance");
  const exportData = () => {
    const keys =
      kind === "expenses"
        ? ["description", "amount", "category", "date", "employeeName"]
        : kind === "stock"
          ? ["name", "quantity", "unit", "min", "cost", "supplier"]
          : ["name", "price", "enabled"];
    exportCSV(`DZ-${kind}-${dateKey(new Date())}.csv`, [
      keys,
      ...items.map((item) => keys.map((k) => String(item[k] ?? ""))),
    ]);
  };
  return (
    <div className="page-enter management-page" key={kind}>
      <SectionHeading title={PAGE_LABELS[kind]} description={c.description}>
        {["stock", "expenses"].includes(kind) && (
          <button className="button button-secondary" onClick={exportData}>
            <Download size={16} />
            Exporter
          </button>
        )}
        {can("create") && (
          <button
            className="button button-primary"
            onClick={() => edit(c.singular)}
          >
            <Plus size={17} />
            {c.add}
          </button>
        )}
      </SectionHeading>
      <div className={`management-intro intro-${kind}`}>
        <span className="management-intro-icon">
          <c.icon size={27} strokeWidth={1.5} />
        </span>
        <div>
          <h2>{c.title}</h2>
          <p>
            {kind === "products"
              ? `${records.length} produit${records.length !== 1 ? "s" : ""} dans votre catalogue · ${records.filter((p) => p.enabled).length} disponible${records.filter((p) => p.enabled).length !== 1 ? "s" : ""} en caisse`
              : kind === "categories"
                ? `${records.length} catégorie${records.length !== 1 ? "s" : ""} · Une carte à votre image`
                : kind === "stock"
                  ? `${records.length} ingrédient${records.length !== 1 ? "s" : ""} · ${state.stock.filter((s) => s.quantity <= s.min).length} alerte${state.stock.filter((s) => s.quantity <= s.min).length !== 1 ? "s" : ""} de stock`
                  : kind === "expenses"
                    ? `${finance ? money(state.expenses.filter((e) => !e.inventoryPurchase).reduce((s, e) => s + e.amount, 0)) : "—"} de charges enregistrées · Les achats de stock ne sont pas comptés deux fois`
                    : `${records.filter((e) => e.active).length} compte${records.filter((e) => e.active).length !== 1 ? "s" : ""} actif${records.filter((e) => e.active).length !== 1 ? "s" : ""} · Des accès sécurisés pour votre équipe`}
          </p>
        </div>
        <span className="intro-decoration">
          <c.icon size={92} strokeWidth={0.7} />
        </span>
      </div>
      <section className="panel management-panel">
        <div className="management-tabs">
          <button
            className={tab === "items" ? "active" : ""}
            onClick={() => setTab("items")}
          >
            {kind === "stock"
              ? "Ingrédients"
              : kind === "products"
                ? "Tous les produits"
                : kind === "expenses"
                  ? "Toutes les dépenses"
                  : kind === "categories"
                    ? "Toutes les catégories"
                    : "Votre équipe"}
            <span>{records.length}</span>
          </button>
          {kind === "stock" && (
            <button
              className={tab === "history" ? "active" : ""}
              onClick={() => setTab("history")}
            >
              <History size={15} />
              Historique des mouvements<span>{state.movements.length}</span>
            </button>
          )}
          <div className="tabs-spacer" />
          {kind === "stock" && can("edit") && records.length > 0 && (
            <button
              className="movement-tab-button"
              onClick={() => edit("movement")}
            >
              <ArrowDownLeft size={15} />
              Mouvement de stock
            </button>
          )}
        </div>
        {tab === "items" ? (
          <>
            <div className="table-toolbar">
              <SearchInput
                value={search}
                onChange={(v) => {
                  setSearch(v);
                  setPageNumber(1);
                }}
                placeholder={`Rechercher ${kind === "products" ? "un produit" : kind === "categories" ? "une catégorie" : kind === "stock" ? "un ingrédient" : kind === "expenses" ? "une dépense" : "un employé"}…`}
              />
              <div className="toolbar-right">
                {kind === "products" && (
                  <Select
                    value={filter}
                    onChange={(v) => {
                      setFilter(v);
                      setPageNumber(1);
                    }}
                    label="Catégorie"
                  >
                    <option value="all">Toutes les catégories</option>
                    {state.categories.map((cat) => (
                      <option value={cat.id} key={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </Select>
                )}
                {kind === "stock" && (
                  <Select
                    value={filter}
                    onChange={(v) => {
                      setFilter(v);
                      setPageNumber(1);
                    }}
                  >
                    <option value="all">Tout le stock</option>
                    <option value="low">Stock faible uniquement</option>
                  </Select>
                )}
                {kind === "employees" && (
                  <Select
                    value={filter}
                    onChange={(v) => {
                      setFilter(v);
                      setPageNumber(1);
                    }}
                  >
                    <option value="all">Tous les rôles</option>
                    {[
                      "Administrateur",
                      "Manager",
                      "Caissier",
                      "Personnalisé",
                    ].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                )}
                {kind === "expenses" && (
                  <>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setPageNumber(1);
                      }}
                      aria-label="Date des dépenses"
                      className="filter-date"
                    />
                    <Select
                      value={filter}
                      onChange={(v) => {
                        setFilter(v);
                        setPageNumber(1);
                      }}
                    >
                      <option value="all">Toutes les catégories</option>
                      {[...new Set(state.expenses.map((e) => e.category))].map(
                        (cat) => (
                          <option key={cat}>{cat}</option>
                        ),
                      )}
                    </Select>
                  </>
                )}
                {["products", "categories"].includes(kind) && (
                  <div className="view-toggle">
                    <button
                      className={view === "grid" ? "active" : ""}
                      onClick={() => setView("grid")}
                      aria-label="Vue grille"
                    >
                      <LayoutGrid size={17} />
                    </button>
                    <button
                      className={view === "list" ? "active" : ""}
                      onClick={() => setView("list")}
                      aria-label="Vue liste"
                    >
                      <List size={17} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            {items.length === 0 ? (
              <Empty
                icon={c.icon}
                title={
                  search || filter !== "all" || date
                    ? "Aucun résultat pour cette recherche"
                    : c.empty
                }
                description={
                  search || filter !== "all" || date
                    ? "Essayez un autre terme ou modifiez vos filtres."
                    : c.emptyText
                }
                action={
                  !records.length && can("create")
                    ? () => edit(c.singular)
                    : undefined
                }
                label={c.add}
              />
            ) : (
              <>
                {["products", "categories"].includes(kind) &&
                view === "grid" ? (
                  <div
                    className={`catalog-grid ${kind === "categories" ? "category-grid" : ""}`}
                  >
                    {shown.map((item) => (
                      <article
                        className={`catalog-card ${item.enabled === false ? "product-disabled" : ""}`}
                        key={item.id}
                      >
                        <div className="catalog-image">
                          {item.image ? (
                            <img src={item.image} alt={item.name} />
                          ) : (
                            <div className="catalog-placeholder">
                              <c.icon size={52} strokeWidth={1.2} />
                            </div>
                          )}
                          {kind === "products" && (
                            <Badge tone={item.enabled ? "green" : "muted"}>
                              {item.enabled ? "En vente" : "Désactivé"}
                            </Badge>
                          )}
                          <div className="catalog-card-actions">
                            {can("edit") && (
                              <button
                                className="icon-button"
                                onClick={() => edit(c.singular, item)}
                                aria-label={`Modifier ${item.name}`}
                              >
                                <Pencil size={15} />
                              </button>
                            )}
                            {can("delete") && (
                              <button
                                className="icon-button danger-hover"
                                onClick={() => remove(c.singular, item)}
                                aria-label={`Supprimer ${item.name}`}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="catalog-info">
                          <span className="catalog-category">
                            {kind === "products"
                              ? state.categories.find(
                                  (c) => c.id === item.categoryId,
                                )?.name || "Sans catégorie"
                              : `POSITION ${item.order || 0}`}
                          </span>
                          <h3>{item.name}</h3>
                          <div className="catalog-price-row">
                            <strong>
                              {kind === "products"
                                ? money(item.price)
                                : `${state.products.filter((p) => p.categoryId === item.id).length} produit(s)`}
                            </strong>
                            <button
                              className="plain-button"
                              onClick={() => edit(c.singular, item)}
                              title="Ouvrir la fiche"
                            >
                              <ArrowUpRight size={18} />
                            </button>
                          </div>
                          {kind === "products" && finance && (
                            <small className="catalog-cost">
                              {item.recipe.length
                                ? `${item.recipe.length} ingrédient(s) dans la recette`
                                : `Coût configuré : ${money(item.cost)}`}
                            </small>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table className="data-table full-table">
                      <thead>
                        <tr>
                          {kind === "products" ? (
                            <>
                              <th>PRODUIT</th>
                              <th>CATÉGORIE</th>
                              <th>PRIX</th>
                              <th>DISPONIBILITÉ</th>
                            </>
                          ) : kind === "categories" ? (
                            <>
                              <th>CATÉGORIE</th>
                              <th>PRODUITS</th>
                              <th>POSITION</th>
                            </>
                          ) : kind === "stock" ? (
                            <>
                              <th>INGRÉDIENT</th>
                              <th>QUANTITÉ</th>
                              <th>SEUIL D’ALERTE</th>
                              {finance && <th>COÛT / UNITÉ</th>}
                              <th>ÉTAT</th>
                            </>
                          ) : kind === "expenses" ? (
                            <>
                              <th>DESCRIPTION</th>
                              <th>CATÉGORIE</th>
                              <th>DATE</th>
                              <th>ENREGISTRÉ PAR</th>
                              <th>MONTANT</th>
                            </>
                          ) : (
                            <>
                              <th>EMPLOYÉ</th>
                              <th>RÔLE</th>
                              <th>ACCÈS</th>
                              <th>STATUT</th>
                            </>
                          )}
                          <th className="align-right">ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((item) => (
                          <tr key={item.id}>
                            {kind === "products" ? (
                              <>
                                <td>
                                  <div className="table-entity">
                                    <ProductThumb
                                      image={item.image}
                                      name={item.name}
                                      type="product"
                                    />
                                    <strong>{item.name}</strong>
                                  </div>
                                </td>
                                <td>
                                  {state.categories.find(
                                    (c) => c.id === item.categoryId,
                                  )?.name || "—"}
                                </td>
                                <td className="amount-cell">
                                  {money(item.price)}
                                </td>
                                <td>
                                  <Badge
                                    tone={item.enabled ? "green" : "muted"}
                                  >
                                    {item.enabled ? "En vente" : "Désactivé"}
                                  </Badge>
                                </td>
                              </>
                            ) : kind === "categories" ? (
                              <>
                                <td>
                                  <div className="table-entity">
                                    <ProductThumb
                                      image={item.image}
                                      name={item.name}
                                      type="category"
                                    />
                                    <strong>{item.name}</strong>
                                  </div>
                                </td>
                                <td>
                                  {
                                    state.products.filter(
                                      (p) => p.categoryId === item.id,
                                    ).length
                                  }
                                </td>
                                <td>{item.order}</td>
                              </>
                            ) : kind === "stock" ? (
                              <>
                                <td>
                                  <div className="table-entity">
                                    <ProductThumb
                                      image={item.image}
                                      name={item.name}
                                      type="stock"
                                    />
                                    <span>
                                      <strong>{item.name}</strong>
                                      <small>
                                        {item.supplier ||
                                          "Aucun fournisseur renseigné"}
                                      </small>
                                    </span>
                                  </div>
                                </td>
                                <td className="amount-cell">
                                  {Number(item.quantity).toLocaleString(
                                    "fr-FR",
                                  )}{" "}
                                  <span className="text-muted">
                                    {item.unit}
                                  </span>
                                </td>
                                <td>
                                  {item.min} {item.unit}
                                </td>
                                {finance && <td>{money(item.cost)}</td>}
                                <td>
                                  <Badge
                                    tone={
                                      item.quantity <= item.min
                                        ? "red"
                                        : "green"
                                    }
                                  >
                                    {item.quantity <= item.min
                                      ? "Stock faible"
                                      : "Disponible"}
                                  </Badge>
                                </td>
                              </>
                            ) : kind === "expenses" ? (
                              <>
                                <td>
                                  <strong>{item.description}</strong>
                                  {item.inventoryPurchase && (
                                    <small className="text-gold">
                                      Achat de stock · exclu des charges
                                    </small>
                                  )}
                                </td>
                                <td>
                                  <span className="category-label">
                                    {item.category}
                                  </span>
                                </td>
                                <td>
                                  {new Date(item.date).toLocaleDateString(
                                    "fr-FR",
                                  )}
                                </td>
                                <td>{item.employeeName}</td>
                                <td className="amount-cell">
                                  {money(item.amount)}
                                </td>
                              </>
                            ) : (
                              <>
                                <td>
                                  <div className="table-entity">
                                    <span className="avatar small-avatar">
                                      {String(item.name)
                                        .split(" ")
                                        .map((n) => n[0])
                                        .slice(0, 2)
                                        .join("")}
                                    </span>
                                    <span>
                                      <strong>{item.name}</strong>
                                      <small>
                                        @{item.username}
                                        {item.isOwner ? " · Propriétaire" : ""}
                                      </small>
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className="role-label">
                                    <ShieldCheck size={14} />
                                    {item.role}
                                  </span>
                                </td>
                                <td>
                                  {item.role === "Administrateur"
                                    ? "Accès complet"
                                    : `${item.pages.length} page(s) autorisée(s)`}
                                </td>
                                <td>
                                  <Badge tone={item.active ? "green" : "muted"}>
                                    {item.active ? "Actif" : "Désactivé"}
                                  </Badge>
                                </td>
                              </>
                            )}
                            <td>
                              <div className="table-actions">
                                {kind === "stock" && can("edit") && (
                                  <button
                                    className="icon-button"
                                    onClick={() =>
                                      edit("movement", { stockId: item.id })
                                    }
                                    title="Mouvement de stock"
                                  >
                                    <ArrowDownLeft size={16} />
                                  </button>
                                )}
                                {can("edit") && (
                                  <button
                                    className="icon-button"
                                    onClick={() => edit(c.singular, item)}
                                    title="Modifier"
                                  >
                                    <Pencil size={16} />
                                  </button>
                                )}
                                {can("delete") && !item.isOwner && (
                                  <button
                                    className="icon-button danger-hover"
                                    onClick={() => remove(c.singular, item)}
                                    title="Supprimer"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="pagination">
                  <span>
                    {Math.min((pageNumber - 1) * 12 + 1, items.length)}–
                    {Math.min(pageNumber * 12, items.length)} sur {items.length}{" "}
                    résultat(s)
                  </span>
                  <div>
                    <button
                      className="button button-secondary button-small"
                      disabled={pageNumber === 1}
                      onClick={() => setPageNumber((n) => n - 1)}
                    >
                      Précédent
                    </button>
                    <span>{pageNumber}</span>
                    <button
                      className="button button-secondary button-small"
                      disabled={pageNumber * 12 >= items.length}
                      onClick={() => setPageNumber((n) => n + 1)}
                    >
                      Suivant
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="table-scroll">
            {state.movements.length ? (
              <table className="data-table full-table">
                <thead>
                  <tr>
                    <th>DATE</th>
                    <th>INGRÉDIENT</th>
                    <th>MOUVEMENT</th>
                    <th>MOTIF</th>
                    <th>EMPLOYÉ</th>
                  </tr>
                </thead>
                <tbody>
                  {state.movements.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {new Date(m.date).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <strong>{m.name}</strong>
                      </td>
                      <td>
                        <span
                          className={m.delta > 0 ? "text-green" : "text-red"}
                        >
                          {m.delta > 0 ? "+" : ""}
                          {Number(m.delta.toFixed(6))} {m.unit}
                        </span>
                      </td>
                      <td>{m.reason}</td>
                      <td>{m.employeeName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty
                icon={History}
                title="Chaque mouvement a son histoire"
                description="Les entrées, ventes et remboursements seront enregistrés automatiquement ici."
              />
            )}
          </div>
        )}
      </section>
      <div className="page-security-note">
        <ShieldCheck size={14} />
        Données partagées et persistantes · Chaque modification est synchronisée
        entre vos navigateurs.
      </div>
    </div>
  );
}
function ProductThumb({
  image,
  name,
  type,
}: {
  image: string;
  name: string;
  type: string;
}) {
  const Icon =
    type === "stock" ? Package : type === "category" ? Layers3 : Pizza;
  return image ? (
    <img className="table-thumb" src={image} alt={name} />
  ) : (
    <span className="table-thumb thumb-placeholder">
      <Icon size={20} strokeWidth={1.4} />
    </span>
  );
}
export function OrdersPage() {
  const {
    state,
    navigate,
    can,
    request,
    refresh,
    notify,
    printReceipt,
    ensureAuth,
  } = useApp();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [nextStatus, setNextStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const order = state.orders.find((o) => o.id === selected);
  const orders = state.orders.filter(
    (o) =>
      (filter === "all" || o.status === filter) &&
      (!date || dateKey(o.date) === date) &&
      (
        o.number +
        " " +
        o.employeeName +
        " " +
        o.items.map((i) => i.name).join(" ")
      )
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const changeStatus = async () => {
    if (!order || !nextStatus || !ensureAuth()) return;
    setBusy(true);
    try {
      await request(
        "/api/orders",
        { id: order.id, version: order.version, status: nextStatus },
        "PATCH",
      );
      await refresh();
      notify(
        nextStatus === "Annulée"
          ? "Commande annulée. Le stock et les totaux ont été corrigés."
          : "Statut de la commande mis à jour.",
      );
      setConfirm(false);
      setNextStatus("");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-enter">
      <SectionHeading
        title="Commandes"
        description="De la première préparation au dernier ticket, rien ne vous échappe."
      >
        <button
          className="button button-primary"
          onClick={() => navigate("pos")}
        >
          <Plus size={17} />
          Nouvelle commande
        </button>
      </SectionHeading>
      <div className="order-summary-grid">
        {[
          {
            label: "En cours",
            value: state.orders.filter((o) =>
              ["En attente", "En préparation", "Prête"].includes(o.status),
            ).length,
            icon: ClipboardList,
            tone: "gold",
          },
          {
            label: "Terminées aujourd’hui",
            value: state.orders.filter(
              (o) =>
                o.status === "Terminée" &&
                dateKey(o.date) === dateKey(new Date()),
            ).length,
            icon: Check,
            tone: "green",
          },
          {
            label: "Annulées / remboursées",
            value: state.orders.filter((o) => o.status === "Annulée").length,
            icon: RotateCcw,
            tone: "purple",
          },
        ].map((c) => (
          <div className="mini-stat panel" key={c.label}>
            <span className={`overview-icon icon-${c.tone}`}>
              <c.icon size={21} />
            </span>
            <div>
              <small>{c.label}</small>
              <strong>{c.value}</strong>
            </div>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="N° de commande, produit, caissier…"
          />
          <div className="toolbar-right">
            <input
              className="filter-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="Date des commandes"
            />
            <Select value={filter} onChange={setFilter}>
              <option value="all">Tous les statuts</option>
              {STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="table-scroll">
          <table className="data-table full-table">
            <thead>
              <tr>
                <th>COMMANDE</th>
                <th>DATE & HEURE</th>
                <th>ARTICLES</th>
                <th>CAISSIER</th>
                <th>PAIEMENT</th>
                <th>STATUT</th>
                <th className="align-right">TOTAL</th>
                <th />
              </tr>
            </thead>
            {orders.length > 0 && (
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    className="clickable"
                    onClick={() => {
                      setSelected(o.id);
                      setNextStatus("");
                    }}
                  >
                    <td>
                      <strong>{o.number}</strong>
                    </td>
                    <td>
                      {new Date(o.date).toLocaleDateString("fr-FR")}
                      <small>
                        {new Date(o.date).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </td>
                    <td>
                      {o.items.reduce((s, i) => s + i.quantity, 0)} article(s)
                      <small>
                        {o.items
                          .slice(0, 2)
                          .map((i) => i.name)
                          .join(", ")}
                        {o.items.length > 2 ? "…" : ""}
                      </small>
                    </td>
                    <td>{o.employeeName}</td>
                    <td>{o.payment}</td>
                    <td>
                      <Badge tone={statusTone(o.status)}>{o.status}</Badge>
                    </td>
                    <td className="align-right amount-cell">
                      {money(o.total)}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="icon-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            printReceipt(o);
                          }}
                          aria-label={`Imprimer ${o.number}`}
                        >
                          <Printer size={16} />
                        </button>
                        <button className="icon-button" title="Voir le détail">
                          <Eye size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        {!orders.length && (
          <Empty
            icon={ClipboardList}
            title={
              state.orders.length
                ? "Aucune commande correspondante"
                : "La première commande ouvre le bal"
            }
            description={
              state.orders.length
                ? "Modifiez vos filtres pour retrouver vos commandes."
                : "Retrouvez ici chaque commande, ses articles, son statut et son ticket."
            }
            action={() => navigate("pos")}
            label="Ouvrir la caisse"
          />
        )}
        <div className="table-bottom-note">
          <span>{orders.length} commande(s)</span>
          <span>
            <ShieldCheck size={13} />
            Aucune vente comptée deux fois
          </span>
        </div>
      </section>
      {order && (
        <Modal
          title={order.number}
          subtitle={`${new Date(order.date).toLocaleString("fr-FR")} · ${order.employeeName}`}
          onClose={() => !busy && setSelected(null)}
          busy={busy}
        >
          <div className="order-detail">
            <div className="order-detail-top">
              <Badge tone={statusTone(order.status)}>{order.status}</Badge>
              <span>{order.payment}</span>
            </div>
            {order.items.map((item, i) => (
              <div className="order-detail-item" key={i}>
                <span className="quantity-badge">{item.quantity}×</span>
                <div>
                  <strong>
                    {item.name}
                    {item.size ? " · " + item.size : ""}
                  </strong>
                  <small>
                    {item.extras.join(", ") || money(item.price) + " / unité"}
                  </small>
                </div>
                <strong>{money(item.price * item.quantity)}</strong>
              </div>
            ))}
            <div className="order-totals">
              <div>
                <span>Sous-total</span>
                <span>{money(order.subtotal)}</span>
              </div>
              {order.discount > 0 && (
                <div>
                  <span>Remise</span>
                  <span>− {money(order.discount)}</span>
                </div>
              )}
              <div className="grand-total">
                <span>Total</span>
                <strong>{money(order.total)}</strong>
              </div>
              <div>
                <span>Montant reçu</span>
                <span>{money(order.received)}</span>
              </div>
              <div>
                <span>Monnaie rendue</span>
                <span>{money(order.change)}</span>
              </div>
            </div>
            {order.status !== "Annulée" && (
              <div className="order-status-editor">
                <label className="field">
                  <span>Mettre à jour la commande</span>
                  <select
                    value={nextStatus}
                    onChange={(e) => setNextStatus(e.target.value)}
                  >
                    <option value="">Choisir un nouveau statut</option>
                    {STATUSES.filter(
                      (s) =>
                        s !== order.status &&
                        (order.status !== "Terminée" || s === "Annulée") &&
                        (s === "Annulée"
                          ? can("cancel")
                          : s === "Terminée"
                            ? can("complete")
                            : can("edit")),
                    ).map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
                {nextStatus === "Terminée" && (
                  <p className="field-hint">
                    Le montant exact ({money(order.total)}) sera enregistré
                    comme reçu.
                  </p>
                )}
                {nextStatus && (
                  <button
                    className={`button ${nextStatus === "Annulée" ? "button-danger" : "button-primary"}`}
                    disabled={busy}
                    onClick={() =>
                      nextStatus === "Annulée"
                        ? setConfirm(true)
                        : void changeStatus()
                    }
                  >
                    {busy
                      ? "Mise à jour…"
                      : nextStatus === "Annulée"
                        ? order.stockDeducted
                          ? "Rembourser la commande"
                          : "Annuler la commande"
                        : "Confirmer le statut"}
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button button-secondary"
              onClick={() => setSelected(null)}
              disabled={busy}
            >
              Fermer
            </button>
            <button
              className="button button-primary"
              onClick={() => printReceipt(order)}
            >
              <Printer size={16} />
              Imprimer le ticket
            </button>
          </div>
        </Modal>
      )}
      {confirm && order && (
        <Modal
          title={
            order.stockDeducted
              ? "Confirmer le remboursement ?"
              : "Annuler cette commande ?"
          }
          subtitle="Le chiffre d’affaires et le bénéfice seront recalculés."
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <div className="confirmation-body">
            <AlertTriangle size={32} />
            <p>
              {order.stockDeducted
                ? "Les ingrédients consommés seront réintégrés au stock. Le remboursement physique doit être effectué par le caissier."
                : "Aucune recette n’a encore été déduite du stock."}
            </p>
            <strong>
              {order.number} · {money(order.total)}
            </strong>
          </div>
          <div className="modal-footer">
            <button
              className="button button-secondary"
              onClick={() => setConfirm(false)}
              disabled={busy}
            >
              Conserver
            </button>
            <button
              className="button button-danger"
              disabled={busy}
              onClick={() => void changeStatus()}
            >
              {busy ? "Traitement…" : "Confirmer l’annulation"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
