"use client";
import { useMemo, useState } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ShoppingBag,
  Wallet,
  TrendingUp,
  ReceiptText,
  CalendarDays,
  ChevronDown,
  Plus,
  Pizza,
  Flame,
  Package,
  CalendarRange,
  ChartNoAxesCombined,
  ClipboardList,
  Sparkles,
  ShieldCheck,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { useApp } from "./context";
import { Badge, Empty, SectionHeading, statusTone, Select } from "./ui";
import { ProfitChart } from "./charts";
import { dateKey, financials, money } from "@/lib/types";
export function Dashboard() {
  const { state, navigate, edit, user, can, openLogin } = useApp();
  const [range, setRange] = useState("today");
  const today = dateKey(new Date());
  const start = new Date();
  start.setDate(start.getDate() - 6);
  const week = financials(state, dateKey(start), today);
  const month = financials(state, today.slice(0, 7) + "-01", today);
  const current =
    range === "week"
      ? week
      : range === "month"
        ? month
        : financials(state, today, today);
  const low = state.stock.filter((s) => s.quantity <= s.min);
  const finance =
    !user || user.role === "Administrateur" || user.actions.includes("finance");
  const recent = state.orders.slice(0, 4);
  const popular = useMemo(() => {
    const counts = new Map<
      string,
      { name: string; quantity: number; image: string; revenue: number }
    >();
    for (const order of state.orders.filter((o) => o.status === "Terminée"))
      for (const item of order.items) {
        const old = counts.get(item.productId) || {
          name: item.name,
          quantity: 0,
          image: item.image,
          revenue: 0,
        };
        old.quantity += item.quantity;
        old.revenue += item.price * item.quantity;
        counts.set(item.productId, old);
      }
    return [...counts.values()]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);
  }, [state.orders]);
  const when =
    range === "today"
      ? "aujourd’hui"
      : range === "week"
        ? "cette semaine"
        : "ce mois-ci";
  return (
    <div className="dashboard page-enter">
      <SectionHeading
        title="Tableau de bord"
        description="Une vision claire. Un service de légende."
      >
        <div className="date-display">
          <CalendarDays size={16} />
          <span>
            {new Date().toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>
        {can("view", "pos") && (
          <button
            className="button button-primary"
            onClick={() => navigate("pos")}
          >
            <ShoppingBag size={17} />
            Ouvrir la caisse
            <ArrowUpRight size={16} />
          </button>
        )}
      </SectionHeading>
      <section className="welcome-banner">
        <img
          className="hero-pizza"
          src="/images/pizza-hero.webp"
          alt="Pizza artisanale fraîchement préparée au basilic"
        />
        <div className="hero-shade" />
        <div className="welcome-content">
          <span className="hero-eyebrow">
            <span />
            LE GOÛT DU TRAVAIL BIEN FAIT
          </span>
          <h2>
            Les bonnes recettes font
            <br />
            les grandes <span>réussites.</span>
          </h2>
          <p>Votre pizzeria, parfaitement orchestrée. À vous de jouer.</p>
          {state.products.length === 0 ? (
            <button className="hero-link" onClick={() => edit("product")}>
              <span className="hero-link-icon">
                <Plus size={14} />
              </span>
              Ajouter mon premier produit
              <ArrowUpRight size={15} />
            </button>
          ) : (
            <button className="hero-link" onClick={() => navigate("reports")}>
              <span className="hero-link-icon">
                <ChartNoAxesCombined size={14} />
              </span>
              Découvrir mes performances
              <ArrowUpRight size={15} />
            </button>
          )}
        </div>
        <div className="hero-signature">
          <span>LA PASSION EN CUISINE.</span>
          <strong>LA MAÎTRISE EN COULISSES.</strong>
        </div>
      </section>
      <div className="section-subheading">
        <div>
          <span className="tiny-gold-line" />
          <h2>Votre activité, en un coup d’œil</h2>
        </div>
        <Select
          value={range}
          onChange={setRange}
          label="Période des indicateurs"
        >
          <option value="today">Aujourd’hui</option>
          <option value="week">7 derniers jours</option>
          <option value="month">Ce mois-ci</option>
        </Select>
      </div>
      <div className="kpi-grid">
        {[
          {
            title: "Chiffre d’affaires",
            value: current.revenue,
            icon: Wallet,
            color: "gold",
            description: "Ventes encaissées " + when,
          },
          {
            title: "Bénéfice net",
            value: current.profit,
            icon: TrendingUp,
            color: "green",
            description: "Après coûts et dépenses",
          },
          {
            title: "Commandes",
            value: current.sales.length,
            icon: ShoppingBag,
            color: "blue",
            description: "Commandes terminées " + when,
            count: true,
          },
          {
            title: "Dépenses",
            value: current.expenses,
            icon: ReceiptText,
            color: "purple",
            description: "Charges d’exploitation " + when,
          },
        ].map((card, i) => (
          <div className={`kpi-card kpi-${card.color}`} key={card.title}>
            <div className="kpi-top">
              <span>{card.title}</span>
              <span className={`kpi-icon icon-${card.color}`}>
                <card.icon size={18} strokeWidth={1.7} />
              </span>
            </div>
            <div className="kpi-value">
              {finance || card.count ? (
                <>
                  {new Intl.NumberFormat("fr-DZ", {
                    maximumFractionDigits: 2,
                  }).format(card.value)}
                  {!card.count && <span>DA</span>}
                </>
              ) : (
                <LockKeyhole size={25} />
              )}
            </div>
            <div className="kpi-bottom">
              <p>
                <span className="kpi-neutral-dot" />
                {card.description}
              </p>
              <svg viewBox="0 0 65 18" className="mini-sparkline">
                <path
                  d="M1 14 H65"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="62" cy="14" r="2.2" fill="currentColor" />
              </svg>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-middle">
        <section className="panel profit-panel">
          <div className="panel-heading">
            <div>
              <div className="panel-title">
                <span className="panel-heading-icon">
                  <ChartNoAxesCombined size={18} />
                </span>
                <h2>Le rythme de votre réussite</h2>
              </div>
              <p>Bénéfice net au fil des 7 derniers jours</p>
            </div>
            <span className="chart-period">
              <span />7 derniers jours
            </span>
          </div>
          {finance ? (
            <>
              <div className="profit-summary">
                <div>
                  <strong>{money(week.profit)}</strong>
                  <span>Bénéfice net sur la période</span>
                </div>
                <span className="zero-change">
                  <span /> {week.sales.length} vente
                  {week.sales.length !== 1 ? "s" : ""} encaissée
                  {week.sales.length !== 1 ? "s" : ""}
                </span>
              </div>
              <ProfitChart state={state} />
              <div className="chart-footer">
                <span>
                  <i className="legend-dot" />
                  Bénéfice net
                </span>
                <p>Recettes − coût des produits − dépenses</p>
                <span className="today-legend">
                  <i />
                  Aujourd’hui
                </span>
              </div>
            </>
          ) : (
            <div className="financial-locked">
              <LockKeyhole size={28} />
              <p>
                Les informations financières sont réservées
                <br />
                aux personnes autorisées.
              </p>
            </div>
          )}
        </section>
        <section className="panel overview-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <span className="panel-heading-icon">
                <LayersIcon />
              </span>
              <h2>Vue d’ensemble</h2>
            </div>
            <span className="live-label">
              <i />
              En direct
            </span>
          </div>
          <div className="overview-rows">
            {[
              {
                label: "Ventes de la semaine",
                caption: "Les 7 derniers jours",
                value: finance ? money(week.revenue) : "—",
                icon: CalendarRange,
                color: "gold",
                target: "reports" as const,
              },
              {
                label: "Ventes du mois",
                caption: new Date().toLocaleDateString("fr-FR", {
                  month: "long",
                  year: "numeric",
                }),
                value: finance ? money(month.revenue) : "—",
                icon: ChartNoAxesCombined,
                color: "blue",
                target: "reports" as const,
              },
              {
                label: "Produits à la carte",
                caption: "Votre catalogue",
                value: String(state.products.length),
                icon: Pizza,
                color: "green",
                target: "products" as const,
              },
              {
                label: "Stock faible",
                caption: low.length
                  ? "Un réapprovisionnement à prévoir"
                  : "Aucune alerte pour le moment",
                value: String(low.length),
                icon: Package,
                color: low.length ? "red" : "purple",
                target: "stock" as const,
              },
            ].map((row) => (
              <button
                className="overview-row"
                key={row.label}
                onClick={() => navigate(row.target)}
              >
                <span className={`overview-icon icon-${row.color}`}>
                  <row.icon size={19} strokeWidth={1.6} />
                </span>
                <span className="overview-row-text">
                  <strong>{row.label}</strong>
                  <small>{row.caption}</small>
                </span>
                <span className="overview-value">{row.value}</span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          <div className="overview-bottom">
            <ShieldCheck size={15} />
            <span>Des chiffres réels. Une gestion sereine.</span>
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <span className="panel-heading-icon">
                <ClipboardList size={18} />
              </span>
              <h2>Dernières commandes</h2>
              <span className="count-pill">{state.orders.length}</span>
            </div>
            <button className="text-button" onClick={() => navigate("orders")}>
              Tout voir
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="table-scroll">
            <table className="data-table recent-table">
              <thead>
                <tr>
                  <th>N° COMMANDE</th>
                  <th>HEURE</th>
                  <th>STATUT</th>
                  <th className="align-right">MONTANT</th>
                </tr>
              </thead>
              {recent.length > 0 && (
                <tbody>
                  {recent.map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => navigate("orders")}
                      className="clickable"
                    >
                      <td>
                        <strong>{order.number}</strong>
                        <small>{order.employeeName}</small>
                      </td>
                      <td>
                        {new Date(order.date).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <Badge tone={statusTone(order.status)}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="align-right amount-cell">
                        {money(order.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              )}
            </table>
          </div>
          {!recent.length && (
            <Empty
              icon={ClipboardList}
              title="Les premières commandes arrivent bientôt"
              description="Chaque commande encaissée trouvera sa place ici."
              action={() => navigate("pos")}
              label="Accéder à la caisse"
              small
            />
          )}
        </section>
        <section className="panel popular-panel">
          <div className="panel-heading">
            <div className="panel-title">
              <span className="panel-heading-icon">
                <Flame size={18} />
              </span>
              <h2>Les favoris de la maison</h2>
            </div>
            <span className="subtle-label">TOP 3</span>
          </div>
          {popular.length ? (
            <div className="popular-list">
              {popular.map((p, i) => (
                <div className="popular-item" key={p.name}>
                  <span className="popular-rank">0{i + 1}</span>
                  {p.image ? (
                    <img src={p.image} alt={p.name} />
                  ) : (
                    <div className="product-placeholder">
                      <Pizza size={23} />
                    </div>
                  )}
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.quantity} vendu{p.quantity > 1 ? "s" : ""}
                    </small>
                  </div>
                  <span>{money(p.revenue)}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={Pizza}
              title="Vos futurs best-sellers sont ici"
              description="Les produits les plus appréciés se dévoileront au fil des ventes."
              small
            />
          )}
          <button
            className="popular-footer"
            onClick={() => navigate("products")}
          >
            <span>Une carte à votre image</span>
            <ArrowUpRight size={15} />
          </button>
        </section>
      </div>
      {low.length > 0 && (
        <section className="stock-alert-banner">
          <Package size={22} />
          <div>
            <strong>
              {low.length} ingrédient{low.length > 1 ? "s" : ""} à
              réapprovisionner
            </strong>
            <p>
              {low
                .slice(0, 4)
                .map((s) => s.name)
                .join(" · ")}
            </p>
          </div>
          <button
            className="button button-secondary button-small"
            onClick={() => navigate("stock")}
          >
            Voir le stock
            <ArrowRight size={15} />
          </button>
        </section>
      )}
      {state.setup && (
        <div className="setup-nudge">
          <span className="setup-nudge-icon">
            <Sparkles size={20} />
          </span>
          <div>
            <strong>Un espace neuf. Des possibilités infinies.</strong>
            <p>
              Créez votre compte administrateur, puis donnez vie à votre carte.
            </p>
          </div>
          <button className="text-button" onClick={openLogin}>
            Configurer mon espace
            <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function LayersIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
