"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  Download,
  Printer,
  CalendarDays,
  TrendingUp,
  Wallet,
  Package,
  ReceiptText,
  ArrowUpRight,
  Flame,
  Users,
  Layers3,
  BarChart3,
  FileText,
  ShieldCheck,
  LockKeyhole,
  Store,
  Phone,
  MapPin,
  Save,
  Sun,
  Moon,
  Database,
  RotateCcw,
  Upload,
  AlertTriangle,
  Check,
  Settings2,
  Palette,
  Info,
  Pizza,
  ArrowRight,
  Clock3,
} from "lucide-react";
import { useApp, type Draft } from "./context";
import { Badge, Empty, Field, Modal, SectionHeading } from "./ui";
import { ImageUpload } from "./editors";
import { RevenueChart } from "./charts";
import { dateKey, financials, money, type Settings } from "@/lib/types";
import { exportCSV } from "@/lib/printing";
export function Reports() {
  const { state, user } = useApp();
  const today = dateKey(new Date());
  const week = new Date();
  week.setDate(week.getDate() - 6);
  const [from, setFrom] = useState(dateKey(week));
  const [to, setTo] = useState(today);
  const [preset, setPreset] = useState("week");
  const [metric, setMetric] = useState("revenue");
  const finance =
    !user || user.role === "Administrateur" || user.actions.includes("finance");
  const valid = from <= to && !!from && !!to;
  const stats = financials(state, valid ? from : today, valid ? to : today);
  const dates = useMemo(() => {
    if (!valid) return [];
    const list: string[] = [];
    const d = new Date(from + "T12:00:00");
    while (dateKey(d) <= to && list.length < 366) {
      list.push(dateKey(d));
      d.setDate(d.getDate() + 1);
    }
    return list;
  }, [from, to, valid]);
  const series = dates.map((date) => financials(state, date, date));
  const setPeriod = (period: string) => {
    setPreset(period);
    setTo(today);
    if (period === "today") setFrom(today);
    if (period === "week") setFrom(dateKey(week));
    if (period === "month") setFrom(today.slice(0, 7) + "-01");
  };
  const groups = useMemo(() => {
    const products = new Map<
      string,
      { label: string; quantity: number; amount: number }
    >();
    const categories = new Map<string, number>();
    const staff = new Map<string, number>();
    for (const order of stats.sales) {
      staff.set(
        order.employeeName,
        (staff.get(order.employeeName) || 0) + order.total,
      );
      for (const item of order.items) {
        const p = products.get(item.productId) || {
          label: item.name,
          quantity: 0,
          amount: 0,
        };
        const revenue = order.subtotal
          ? (item.price * item.quantity * order.total) / order.subtotal
          : 0;
        p.quantity += item.quantity;
        p.amount += revenue;
        products.set(item.productId, p);
        const category =
          item.categoryName ||
          state.categories.find(
            (c) =>
              c.id ===
              state.products.find((p) => p.id === item.productId)?.categoryId,
          )?.name ||
          "Sans catégorie";
        categories.set(category, (categories.get(category) || 0) + revenue);
      }
    }
    return {
      products: [...products.values()].sort((a, b) => b.quantity - a.quantity),
      categories: [...categories].sort((a, b) => b[1] - a[1]),
      staff: [...staff].sort((a, b) => b[1] - a[1]),
    };
  }, [stats.sales, state.products, state.categories]);
  const consumption = useMemo(() => {
    const m = new Map<
      string,
      { name: string; quantity: number; unit: string }
    >();
    for (const movement of state.movements.filter(
      (m) => dateKey(m.date) >= from && dateKey(m.date) <= to,
    )) {
      if (!movement.orderId) continue;
      const v = m.get(movement.stockId) || {
        name: movement.name,
        quantity: 0,
        unit: movement.unit,
      };
      v.quantity -= movement.delta;
      m.set(movement.stockId, v);
    }
    return [...m.values()];
  }, [state.movements, from, to]);
  const csv = () =>
    exportCSV(`DZ-Rapport-${from}-${to}.csv`, [
      ["DZ LEGENDS PIZZA", "Rapport du " + from + " au " + to],
      ["Chiffre d’affaires", stats.revenue],
      ["Coût des produits vendus", stats.cogs],
      ["Charges d’exploitation", stats.expenses],
      ["Bénéfice net", stats.profit],
      [],
      [
        "Date",
        "Ventes",
        "Chiffre d’affaires",
        "Coût des produits",
        "Dépenses",
        "Bénéfice net",
      ],
      ...series.map((s, i) => [
        dates[i],
        s.sales.length,
        s.revenue,
        s.cogs,
        s.expenses,
        s.profit,
      ]),
      [],
      ["Produits", "Quantité", "Recettes"],
      ...groups.products.map((p) => [p.label, p.quantity, p.amount]),
      [],
      ["Employé", "Recettes"],
      ...groups.staff,
      [],
      ["Catégorie", "Recettes"],
      ...groups.categories,
      [],
      ["Ingrédient", "Consommation nette", "Unité"],
      ...consumption.map((c) => [c.name, c.quantity, c.unit]),
    ]);
  if (!finance)
    return (
      <div className="page-enter">
        <SectionHeading
          title="Rapports"
          description="Une lecture précise de votre activité."
        />
        <Empty
          icon={LockKeyhole}
          title="Les finances sont un accès privilégié"
          description="Demandez à votre administrateur la permission de consulter les informations financières."
        />
      </div>
    );
  return (
    <div className="reports-page page-enter">
      <SectionHeading
        title="Rapports"
        description="Des chiffres qui parlent. Des décisions qui font avancer."
      >
        <button
          className="button button-secondary"
          onClick={csv}
          disabled={!valid}
        >
          <Download size={16} />
          Exporter CSV
        </button>
        <button
          className="button button-primary"
          onClick={() => window.print()}
          disabled={!valid}
        >
          <Printer size={16} />
          Exporter PDF
        </button>
      </SectionHeading>
      <div className="report-filters panel">
        <div className="period-buttons">
          {[
            ["today", "Aujourd’hui"],
            ["week", "7 derniers jours"],
            ["month", "Ce mois-ci"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={preset === id ? "active" : ""}
              onClick={() => setPeriod(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="report-date-range">
          <CalendarDays size={16} />
          <input
            aria-label="Début de période"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPreset("custom");
            }}
          />
          <span>→</span>
          <input
            aria-label="Fin de période"
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPreset("custom");
            }}
          />
        </div>
      </div>
      {!valid && (
        <div className="form-error">
          <Info size={17} />
          Choisissez une période valide.
        </div>
      )}
      <div className="kpi-grid report-kpis">
        {[
          {
            label: "Chiffre d’affaires",
            value: stats.revenue,
            icon: Wallet,
            tone: "gold",
            hint: `${stats.sales.length} vente(s) terminée(s)`,
          },
          {
            label: "Bénéfice net",
            value: stats.profit,
            icon: TrendingUp,
            tone: "green",
            hint: "Votre rentabilité réelle",
          },
          {
            label: "Coût des produits vendus",
            value: stats.cogs,
            icon: Package,
            tone: "blue",
            hint: "Coûts configurés à la vente",
          },
          {
            label: "Charges d’exploitation",
            value: stats.expenses,
            icon: ReceiptText,
            tone: "purple",
            hint: "Hors achats de stock valorisés",
          },
        ].map((c) => (
          <div className="kpi-card" key={c.label}>
            <div className="kpi-top">
              <span>{c.label}</span>
              <span className={`kpi-icon icon-${c.tone}`}>
                <c.icon size={18} />
              </span>
            </div>
            <div className="kpi-value">{money(c.value)}</div>
            <p className="kpi-hint">{c.hint}</p>
          </div>
        ))}
      </div>
      <section className="panel report-chart-panel">
        <div className="panel-heading">
          <div>
            <div className="panel-title">
              <BarChart3 size={18} />
              <h2>L’évolution de votre activité</h2>
            </div>
            <p>
              {from && new Date(from).toLocaleDateString("fr-FR")} —{" "}
              {to && new Date(to).toLocaleDateString("fr-FR")}
              {dates.length === 366 ? " · Graphique limité à 366 jours" : ""}
            </p>
          </div>
          <div className="period-buttons">
            <button
              className={metric === "revenue" ? "active" : ""}
              onClick={() => setMetric("revenue")}
            >
              Chiffre d’affaires
            </button>
            <button
              className={metric === "profit" ? "active" : ""}
              onClick={() => setMetric("profit")}
            >
              Bénéfice net
            </button>
          </div>
        </div>
        <RevenueChart
          values={series.map((s) =>
            metric === "revenue" ? s.revenue : s.profit,
          )}
          labels={dates.map((d) =>
            new Date(d).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
            }),
          )}
        />
        <div className="report-chart-footer">
          <span className="legend-dot" />
          {metric === "revenue"
            ? "Chiffre d’affaires encaissé"
            : "Bénéfice net après coûts et charges"}
          <span>DA · Données réelles enregistrées</span>
        </div>
      </section>
      <div className="report-breakdowns">
        <ReportBreakdown
          title="Produits les plus vendus"
          icon={Flame}
          rows={groups.products.map((p) => ({
            label: p.label,
            value: p.amount,
            detail: `${p.quantity} vendu(s)`,
          }))}
        />
        <ReportBreakdown
          title="Ventes par catégorie"
          icon={Layers3}
          rows={groups.categories.map(([label, value]) => ({ label, value }))}
        />
        <ReportBreakdown
          title="Ventes par employé"
          icon={Users}
          rows={groups.staff.map(([label, value]) => ({ label, value }))}
        />
      </div>
      <div className="dashboard-bottom report-tables">
        <section className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <CalendarDays size={18} />
              <h2>Le détail, jour après jour</h2>
            </div>
            <Badge>{dates.length} jour(s)</Badge>
          </div>
          <div className="table-scroll report-daily-scroll">
            <table className="data-table full-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>VENTES</th>
                  <th>RECETTES</th>
                  <th>DÉPENSES</th>
                  <th className="align-right">BÉNÉFICE NET</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s, i) => (
                  <tr key={dates[i]}>
                    <td>{new Date(dates[i]).toLocaleDateString("fr-FR")}</td>
                    <td>{s.sales.length}</td>
                    <td>{money(s.revenue)}</td>
                    <td>{money(s.expenses)}</td>
                    <td
                      className={`align-right amount-cell ${s.profit < 0 ? "text-red" : s.profit > 0 ? "text-green" : ""}`}
                    >
                      {money(s.profit)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div className="panel-title">
              <Package size={18} />
              <h2>Consommation du stock</h2>
            </div>
          </div>
          {consumption.length ? (
            <div className="consumption-list">
              {consumption.map((c) => (
                <div key={c.name}>
                  <span>{c.name}</span>
                  <strong>
                    {Number(c.quantity.toFixed(6))} {c.unit}
                  </strong>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={Package}
              title="Aucune consommation"
              description="Les ingrédients de vos recettes apparaîtront après vos premières ventes."
              small
            />
          )}
        </section>
      </div>
      <div className="info-box report-method">
        <ShieldCheck size={18} />
        <span>
          <strong>Une méthode transparente.</strong> Bénéfice net = ventes
          terminées − coûts enregistrés à la vente − charges d’exploitation. Les
          commandes annulées sont exclues. Un coût non configuré reste à zéro,
          il n’est jamais estimé.
        </span>
      </div>
    </div>
  );
}
function ReportBreakdown({
  title,
  icon: Icon,
  rows,
}: {
  title: string;
  icon: typeof Flame;
  rows: { label: string; value: number; detail?: string }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <section className="panel report-breakdown">
      <div className="panel-heading">
        <div className="panel-title">
          <Icon size={18} />
          <h2>{title}</h2>
        </div>
      </div>
      {rows.length ? (
        <div className="ranking-list">
          {rows.slice(0, 5).map((r, i) => (
            <div className="ranking-item" key={r.label}>
              <div>
                <strong>
                  <span>0{i + 1}</span>
                  {r.label}
                </strong>
                <span>{money(r.value)}</span>
              </div>
              <div className="ranking-bar">
                <span style={{ width: (r.value / max) * 100 + "%" }} />
              </div>
              {r.detail && <small>{r.detail}</small>}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          icon={Icon}
          title="Les tendances se dessinent bientôt"
          description="Vos ventes feront parler les chiffres."
          small
        />
      )}
    </section>
  );
}
export function SettingsPage() {
  const {
    state,
    request,
    refresh,
    notify,
    ensureAuth,
    theme,
    toggleTheme,
    can,
    user,
  } = useApp();
  const [tab, setTab] = useState("business");
  const [draft, setDraft] = useState<Settings>(state.settings);
  const dirty = useRef(false);
  const [busy, setBusy] = useState(false);
  const [danger, setDanger] = useState<"reset" | "restore" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [backup, setBackup] = useState<Draft | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const serialized = JSON.stringify(state.settings);
  useEffect(() => {
    if (!dirty.current) setDraft(JSON.parse(serialized));
  }, [serialized]);
  const update = (key: keyof Settings, value: unknown) => {
    dirty.current = true;
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const admin = !user || user.role === "Administrateur";
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureAuth()) return;
    setBusy(true);
    try {
      await request("/api/operations", { action: "settings", data: draft });
      dirty.current = false;
      await refresh();
      notify("Paramètres enregistrés. Votre établissement est à jour.");
    } catch (err) {
      notify((err as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const destructive = async () => {
    if (!ensureAuth()) return;
    setBusy(true);
    try {
      await request("/api/backup", { action: danger, confirmation, backup });
      setDanger(null);
      setConfirmation("");
      dirty.current = false;
      await refresh();
      notify(
        danger === "reset"
          ? "Logiciel réinitialisé. Le compte propriétaire a été conservé."
          : "Sauvegarde restaurée. Vos données sont à jour.",
      );
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const downloadBackup = async (automatic = false) => {
    if (!ensureAuth()) return;
    setBusy(true);
    try {
      const res = await fetch(
        "/api/backup" + (automatic ? "?automatic=true" : ""),
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ||
        "DZ-Legends-sauvegarde.json";
      a.click();
      URL.revokeObjectURL(url);
      notify("Sauvegarde complète téléchargée.");
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-enter settings-page">
      <SectionHeading
        title="Paramètres"
        description="Un logiciel à l’image de votre établissement."
      >
        {tab !== "data" && can("edit") && (
          <button
            form="settings-form"
            className="button button-primary"
            disabled={busy}
          >
            <Save size={16} />
            {busy ? "Enregistrement…" : "Enregistrer les modifications"}
          </button>
        )}
      </SectionHeading>
      <div className="settings-layout">
        <nav className="settings-nav">
          {[
            { id: "business", label: "Mon établissement", icon: Store },
            { id: "receipt", label: "Tickets & impression", icon: Printer },
            { id: "appearance", label: "Apparence", icon: Palette },
            ...(admin
              ? [{ id: "data", label: "Données & sauvegardes", icon: Database }]
              : []),
          ].map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={18} />
              {t.label}
              <ArrowRight size={14} />
            </button>
          ))}
          <div className="settings-nav-note">
            <ShieldCheck size={23} />
            <strong>Votre espace est privé.</strong>
            <p>Les modifications s’appliquent à tout l’établissement.</p>
          </div>
        </nav>
        <div className="settings-content">
          {tab !== "data" ? (
            <form id="settings-form" onSubmit={(e) => void save(e)}>
              <section className="panel settings-panel">
                {tab === "business" ? (
                  <>
                    <div className="settings-section-heading">
                      <span className="overview-icon icon-gold">
                        <Store size={22} />
                      </span>
                      <div>
                        <h2>L’identité de votre pizzeria</h2>
                        <p>Ces informations apparaissent sur vos tickets.</p>
                      </div>
                    </div>
                    <ImageUpload
                      value={draft.logo}
                      onChange={(v) => update("logo", v)}
                      page="settings"
                    />
                    <div className="form-grid">
                      <Field label="Nom de l’établissement *" full>
                        <input
                          value={draft.name}
                          required
                          onChange={(e) => update("name", e.target.value)}
                          maxLength={180}
                        />
                      </Field>
                      <Field label="Adresse" full>
                        <textarea
                          rows={3}
                          value={draft.address}
                          onChange={(e) => update("address", e.target.value)}
                          placeholder="L’adresse de votre pizzeria"
                          maxLength={400}
                        />
                      </Field>
                      <Field label="Téléphone">
                        <input
                          type="tel"
                          value={draft.phone}
                          onChange={(e) => update("phone", e.target.value)}
                          placeholder="Votre numéro de téléphone"
                          maxLength={50}
                        />
                      </Field>
                      <Field label="Devise">
                        <input value="Dinar algérien (DA)" disabled />
                      </Field>
                    </div>
                    <div className="form-section-heading">
                      <div>
                        <Settings2 size={18} />
                        <h3>Préférences métier</h3>
                      </div>
                    </div>
                    <label className="settings-toggle">
                      <span>
                        <strong>Autoriser les stocks négatifs</strong>
                        <small>
                          Désactivé par défaut : une vente est bloquée si un
                          ingrédient manque.
                        </small>
                      </span>
                      <input
                        type="checkbox"
                        checked={draft.allowNegative}
                        onChange={(e) =>
                          update("allowNegative", e.target.checked)
                        }
                      />
                      <span className="switch" />
                    </label>
                  </>
                ) : tab === "receipt" ? (
                  <>
                    <div className="settings-section-heading">
                      <span className="overview-icon icon-blue">
                        <Printer size={22} />
                      </span>
                      <div>
                        <h2>Des tickets à votre image</h2>
                        <p>
                          Compatibles avec l’impression thermique depuis votre
                          navigateur.
                        </p>
                      </div>
                    </div>
                    <Field label="Largeur de votre papier">
                      <div className="receipt-sizes">
                        {["58", "80"].map((size) => (
                          <button
                            type="button"
                            key={size}
                            className={
                              draft.receiptWidth === size ? "active" : ""
                            }
                            onClick={() => update("receiptWidth", size)}
                          >
                            <ReceiptText size={25} />
                            <strong>{size} mm</strong>
                            <span>
                              {size === "80"
                                ? "Format confortable"
                                : "Format compact"}
                            </span>
                            {draft.receiptWidth === size && <Check size={16} />}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Message en bas de ticket" full>
                      <textarea
                        rows={3}
                        maxLength={400}
                        value={draft.footer}
                        onChange={(e) => update("footer", e.target.value)}
                      />
                    </Field>
                    <div className="receipt-preview">
                      <div>
                        <Pizza size={28} />
                        <h3>{draft.name}</h3>
                        <p>
                          {draft.address || "Votre adresse"}
                          <br />
                          {draft.phone || "Votre téléphone"}
                        </p>
                        <hr />
                        <span>APERÇU DU TICKET · {draft.receiptWidth} MM</span>
                        <p className="preview-empty">
                          Votre commande s’affichera ici.
                        </p>
                        <hr />
                        <strong className="preview-total">
                          TOTAL <span>0 DA</span>
                        </strong>
                        <hr />
                        <p>{draft.footer}</p>
                      </div>
                    </div>
                    <div className="info-box">
                      <Info size={17} />
                      <span>
                        Choisissez votre imprimante thermique dans la fenêtre
                        d’impression. Sélectionnez la bonne largeur de papier et
                        désactivez les en-têtes et pieds de page du navigateur.
                        L’impression silencieuse n’est pas activée.
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="settings-section-heading">
                      <span className="overview-icon icon-purple">
                        <Palette size={22} />
                      </span>
                      <div>
                        <h2>Votre espace, votre ambiance</h2>
                        <p>Un thème pensé pour chaque moment de la journée.</p>
                      </div>
                    </div>
                    <div className="theme-cards">
                      {[
                        {
                          id: "dark",
                          label: "Charbon & or",
                          subtitle: "L’élégance des services du soir",
                          icon: Moon,
                        },
                        {
                          id: "light",
                          label: "Lumière & or",
                          subtitle: "La clarté des belles journées",
                          icon: Sun,
                        },
                      ].map((t) => (
                        <button
                          type="button"
                          className={`theme-card ${t.id} ${theme === t.id ? "selected" : ""}`}
                          key={t.id}
                          onClick={() => {
                            if (theme !== t.id) toggleTheme();
                            update("theme", t.id);
                          }}
                        >
                          <div className="theme-mini">
                            <span />
                            <div>
                              <i />
                              <i />
                              <i />
                              <b />
                              <b />
                            </div>
                          </div>
                          <div>
                            <span>
                              <t.icon size={17} />
                              <strong>{t.label}</strong>
                            </span>
                            {theme === t.id && <Check size={17} />}
                          </div>
                          <p>{t.subtitle}</p>
                        </button>
                      ))}
                    </div>
                    <div className="info-box">
                      <Sun size={17} />
                      <span>
                        Le thème change instantanément et reste mémorisé dans ce
                        navigateur. Enregistrez pour en faire le thème par
                        défaut de l’établissement.
                      </span>
                    </div>
                  </>
                )}
              </section>
            </form>
          ) : (
            <div className="data-settings">
              <section className="panel settings-panel">
                <div className="settings-section-heading">
                  <span className="overview-icon icon-green">
                    <Database size={22} />
                  </span>
                  <div>
                    <h2>Protégez ce que vous construisez</h2>
                    <p>
                      Vos produits, images, comptes et paramètres, dans un seul
                      fichier.
                    </p>
                  </div>
                </div>
                <div className="backup-actions">
                  <div>
                    <Download size={25} />
                    <h3>Exporter une sauvegarde</h3>
                    <p>
                      Un fichier complet et horodaté, à conserver dans un
                      endroit sûr.
                    </p>
                    <button
                      className="button button-primary"
                      onClick={() => void downloadBackup()}
                      disabled={busy}
                    >
                      <Download size={16} />
                      Télécharger la sauvegarde
                    </button>
                  </div>
                  <div>
                    <Upload size={25} />
                    <h3>Restaurer vos données</h3>
                    <p>
                      Reprenez votre activité depuis une sauvegarde DZ Legends
                      Pizza.
                    </p>
                    <button
                      className="button button-secondary"
                      onClick={() => {
                        if (ensureAuth()) file.current?.click();
                      }}
                      disabled={busy}
                    >
                      <Upload size={16} />
                      Choisir une sauvegarde
                    </button>
                    <input
                      hidden
                      ref={file}
                      type="file"
                      accept=".json,application/json"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (f.size > 80 * 1024 * 1024) {
                          notify("Le fichier dépasse 80 Mo.", "error");
                          return;
                        }
                        try {
                          const parsed = JSON.parse(await f.text());
                          if (parsed.format !== "dz-legends-v1")
                            throw new Error(
                              "Ce fichier n’est pas une sauvegarde DZ Legends Pizza.",
                            );
                          setBackup(parsed);
                          setDanger("restore");
                          setConfirmation("");
                        } catch (err) {
                          notify((err as Error).message, "error");
                        } finally {
                          e.target.value = "";
                        }
                      }}
                    />
                  </div>
                </div>
                <label className="settings-toggle">
                  <span>
                    <strong>Sauvegardes automatiques</strong>
                    <small>
                      Une copie avant la première modification du jour. Les 14
                      dernières copies sont conservées.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.autoBackup}
                    onChange={(e) => {
                      update("autoBackup", e.target.checked);
                    }}
                  />
                  <span className="switch" />
                </label>
                <div className="auto-backup-status">
                  <Clock3 size={15} />
                  <span>
                    {state.lastBackup
                      ? "Dernière copie : " +
                        new Date(state.lastBackup).toLocaleString("fr-FR")
                      : "La première sauvegarde sera créée lors de votre prochaine modification."}
                  </span>
                  {state.lastBackup && (
                    <button
                      className="text-button"
                      onClick={() => void downloadBackup(true)}
                      disabled={busy}
                    >
                      Télécharger
                      <Download size={14} />
                    </button>
                  )}
                </div>
                {can("edit") && (
                  <button
                    className="button button-secondary button-small"
                    disabled={busy}
                    onClick={(e) => void save(e)}
                  >
                    <Save size={14} />
                    Enregistrer la préférence
                  </button>
                )}
                <div className="info-box">
                  <ShieldCheck size={17} />
                  <span>
                    Une sauvegarde contient des informations privées, y compris
                    les mots de passe hachés. Ne la partagez pas. Le compte
                    propriétaire actuel reste protégé lors d’une restauration.
                  </span>
                </div>
              </section>
              <section className="panel settings-panel danger-zone">
                <div>
                  <span className="overview-icon icon-red">
                    <AlertTriangle size={22} />
                  </span>
                  <h2>Repartir d’une page blanche</h2>
                  <p>
                    Effacer les données métier et les statistiques, sans
                    supprimer le compte propriétaire ni les fichiers du
                    logiciel. Une sauvegarde de sécurité est créée avant
                    l’opération.
                  </p>
                </div>
                <button
                  className="button button-danger-outline"
                  onClick={() => {
                    if (ensureAuth()) {
                      setDanger("reset");
                      setConfirmation("");
                    }
                  }}
                >
                  <RotateCcw size={16} />
                  Réinitialiser le logiciel
                </button>
              </section>
            </div>
          )}
        </div>
      </div>
      {danger && (
        <Modal
          title={
            danger === "reset"
              ? "Réinitialiser le logiciel ?"
              : "Restaurer cette sauvegarde ?"
          }
          subtitle="Cette opération remplace vos données. Une copie de sécurité sera créée avant toute modification."
          onClose={() => !busy && setDanger(null)}
          busy={busy}
        >
          <div className="destructive-body">
            <div className="info-box warning">
              <AlertTriangle size={21} />
              <span>
                {danger === "reset"
                  ? "Les produits, catégories, stocks, commandes, dépenses et comptes secondaires seront effacés. Le propriétaire reste administrateur."
                  : `Sauvegarde du ${backup?.exportedAt ? new Date(backup.exportedAt).toLocaleString("fr-FR") : "date inconnue"} · ${backup?.records?.length || 0} enregistrement(s) · ${backup?.uploads?.length || 0} image(s).`}
              </span>
            </div>
            <Field
              label={`Saisissez ${danger === "reset" ? "RÉINITIALISER" : "RESTAURER"} pour confirmer`}
            >
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
                placeholder={danger === "reset" ? "RÉINITIALISER" : "RESTAURER"}
              />
            </Field>
          </div>
          <div className="modal-footer">
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => setDanger(null)}
            >
              Annuler
            </button>
            <button
              className="button button-danger"
              disabled={
                busy ||
                confirmation !==
                  (danger === "reset" ? "RÉINITIALISER" : "RESTAURER")
              }
              onClick={() => void destructive()}
            >
              {busy
                ? "Traitement en cours…"
                : danger === "reset"
                  ? "Réinitialiser maintenant"
                  : "Restaurer les données"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
