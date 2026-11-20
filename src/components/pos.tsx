"use client";
import { useState } from "react";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingBag,
  ArrowRight,
  Pizza,
  Check,
  Banknote,
  CreditCard,
  MoreHorizontal,
  ReceiptText,
  Printer,
  ShieldCheck,
  UserRound,
  Tag,
  Clock3,
  CheckCheck,
  X,
  Package,
  UtensilsCrossed,
} from "lucide-react";
import { useApp } from "./context";
import { Badge, Empty, Field, Modal, SearchInput, SectionHeading } from "./ui";
import { money, type Product, type CartItem, type Order } from "@/lib/types";
export function POS() {
  const {
    state,
    cart,
    setCart,
    checkoutKey,
    newCheckoutKey,
    request,
    refresh,
    notify,
    ensureAuth,
    can,
    edit,
    printReceipt,
    user,
  } = useApp();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [discount, setDiscount] = useState("0");
  const [showDiscount, setShowDiscount] = useState(false);
  const [payment, setPayment] = useState("Espèces");
  const [received, setReceived] = useState("");
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState<Product | null>(null);
  const [size, setSize] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  const [sale, setSale] = useState<Order | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const products = state.products.filter(
    (p) =>
      p.enabled &&
      (category === "all" || p.categoryId === category) &&
      p.name.toLowerCase().includes(search.toLowerCase()),
  );
  const subtotal =
    Math.round(cart.reduce((s, i) => s + i.price * i.quantity, 0) * 100) / 100;
  const discountValue = showDiscount ? Math.max(0, Number(discount) || 0) : 0;
  const total = Math.max(0, subtotal - discountValue);
  const itemCount = cart.reduce((s, i) => s + i.quantity, 0);
  const change = Number(received || 0) - total;
  function add(
    product: Product,
    selectedSize = "",
    selectedExtras: string[] = [],
  ) {
    if (!ensureAuth()) return;
    const key =
      product.id +
      "-" +
      selectedSize +
      "-" +
      [...selectedExtras].sort().join(",");
    const price =
      (product.sizes.find((s) => s.name === selectedSize)?.price ??
        product.price) +
      selectedExtras.reduce(
        (s, name) =>
          s + (product.extras.find((e) => e.name === name)?.price || 0),
        0,
      );
    setCart((prev) => {
      const found = prev.find((i) => i.key === key);
      return found
        ? prev.map((i) =>
            i.key === key ? { ...i, quantity: i.quantity + 1 } : i,
          )
        : [
            ...prev,
            {
              key,
              productId: product.id,
              name: product.name,
              image: product.image,
              price,
              quantity: 1,
              size: selectedSize,
              extras: selectedExtras,
            },
          ];
    });
    setCustom(null);
  }
  function choose(product: Product) {
    if (!ensureAuth()) return;
    if (product.sizes.length || product.extras.length) {
      setCustom(product);
      setSize(product.sizes[0]?.name || "");
      setExtras([]);
    } else add(product);
  }
  const quantity = (key: string, delta: number) =>
    setCart((items) =>
      items
        .map((i) =>
          i.key === key ? { ...i, quantity: i.quantity + delta } : i,
        )
        .filter((i) => i.quantity > 0),
    );
  const checkout = async (pending = false) => {
    if (!ensureAuth() || !cart.length || busy) return;
    setBusy(true);
    try {
      const order = await request<Order>("/api/orders", {
        items: cart,
        discount: discountValue,
        payment,
        received: payment === "Espèces" ? Number(received) : total,
        status: pending ? "En attente" : "Terminée",
        idempotencyKey: checkoutKey,
      });
      setSale(order);
      setCart([]);
      newCheckoutKey();
      setReceived("");
      setDiscount("0");
      setShowDiscount(false);
      await refresh();
      notify(
        pending
          ? "Commande enregistrée en attente."
          : "Vente enregistrée. Bon service !",
      );
    } catch (e) {
      notify((e as Error).message, "error");
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="page-enter pos-page">
      <SectionHeading
        title="Caisse POS"
        description="Moins de clics. Plus de temps pour vos clients."
      >
        <Badge tone="green">Prête pour le service</Badge>
        <div className="cashier-label">
          <UserRound size={15} />
          {user?.name || "Connexion requise"}
        </div>
      </SectionHeading>
      <div className="pos-layout">
        <section className="pos-catalog">
          <div className="pos-catalog-top">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Trouver un produit sur votre carte…"
            />
            <span>
              {products.length} produit{products.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="category-pills">
            <button
              className={category === "all" ? "active" : ""}
              onClick={() => setCategory("all")}
            >
              <UtensilsCrossed size={16} />
              Toute la carte
              <span>{state.products.filter((p) => p.enabled).length}</span>
            </button>
            {state.categories
              .sort((a, b) => a.order - b.order)
              .map((c) => (
                <button
                  className={category === c.id ? "active" : ""}
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                >
                  {c.image ? (
                    <img src={c.image} alt="" />
                  ) : (
                    <span className="category-pip" />
                  )}
                  {c.name}
                </button>
              ))}
          </div>
          {products.length ? (
            <div className="pos-product-grid">
              {products.map((p) => (
                <button
                  className="pos-product-card"
                  key={p.id}
                  onClick={() => choose(p)}
                  disabled={busy}
                >
                  <div className="pos-product-image">
                    {p.image ? (
                      <img src={p.image} alt={p.name} />
                    ) : (
                      <span className="pos-image-placeholder">
                        <Pizza size={46} strokeWidth={1.2} />
                      </span>
                    )}
                    <span className="product-add">
                      <Plus size={18} />
                    </span>
                  </div>
                  <span className="pos-product-category">
                    {state.categories.find((c) => c.id === p.categoryId)
                      ?.name || "À la carte"}
                  </span>
                  <strong>{p.name}</strong>
                  <span className="pos-product-price">
                    {money(
                      p.sizes.length
                        ? Math.min(...p.sizes.map((s) => s.price))
                        : p.price,
                    )}
                    {p.sizes.length > 0 && <small>à partir de</small>}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="pos-empty-catalog">
              <div className="pos-empty-plate">
                <span />
                <div>
                  <Pizza size={66} strokeWidth={1} />
                </div>
                <i />
                <b />
              </div>
              <span className="eyebrow">LE DÉBUT D’UNE BELLE CARTE</span>
              <h2>
                {state.products.length
                  ? "Aucun produit dans cette sélection"
                  : "Votre carte n’attend que vous."}
              </h2>
              <p>
                {state.products.length
                  ? "Essayez une autre catégorie ou un autre mot-clé."
                  : "Ajoutez vos produits et leurs photos. Ils apparaîtront ici, prêts à être servis."}
              </p>
              {can("create", "products") && (
                <button
                  className="button button-primary"
                  onClick={() => edit("product")}
                >
                  <Plus size={16} />
                  Ajouter mon premier produit
                  <ArrowRight size={16} />
                </button>
              )}
              <div className="pos-empty-features">
                <span>
                  <Check size={14} />
                  Photos circulaires
                </span>
                <span>
                  <Check size={14} />
                  Tailles & suppléments
                </span>
                <span>
                  <Check size={14} />
                  Stock synchronisé
                </span>
              </div>
            </div>
          )}
        </section>
        <aside className="checkout-panel panel">
          <div className="checkout-heading">
            <div>
              <span className="checkout-icon">
                <ShoppingBag size={20} />
              </span>
              <h2>Commande en cours</h2>
              <span className="count-pill">{itemCount}</span>
            </div>
            <button
              className="icon-button danger-hover"
              disabled={!cart.length || busy}
              onClick={() => setClearConfirm(true)}
              title="Vider le panier"
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="cart-items">
            {cart.length ? (
              cart.map((item) => (
                <div className="cart-item" key={item.key}>
                  {item.image ? (
                    <img src={item.image} alt={item.name} />
                  ) : (
                    <span className="cart-image-placeholder">
                      <Pizza size={22} />
                    </span>
                  )}
                  <div className="cart-item-info">
                    <strong>{item.name}</strong>
                    {(item.size || item.extras.length > 0) && (
                      <small>
                        {[item.size, ...item.extras]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    )}
                    <span>{money(item.price)}</span>
                    <div className="cart-quantity">
                      <button
                        onClick={() => quantity(item.key, -1)}
                        disabled={busy}
                        aria-label={`Diminuer ${item.name}`}
                      >
                        <Minus size={12} />
                      </button>
                      <strong>{item.quantity}</strong>
                      <button
                        onClick={() => quantity(item.key, 1)}
                        disabled={busy || item.quantity >= 999}
                        aria-label={`Augmenter ${item.name}`}
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="cart-item-end">
                    <button
                      className="plain-button"
                      onClick={() =>
                        setCart((items) =>
                          items.filter((i) => i.key !== item.key),
                        )
                      }
                      disabled={busy}
                      aria-label={`Retirer ${item.name}`}
                    >
                      <X size={13} />
                    </button>
                    <strong>{money(item.price * item.quantity)}</strong>
                  </div>
                </div>
              ))
            ) : (
              <div className="cart-empty">
                <span>
                  <ShoppingBag size={32} strokeWidth={1.1} />
                </span>
                <strong>Un panier plein de promesses</strong>
                <p>
                  Sélectionnez un produit pour
                  <br />
                  commencer une commande.
                </p>
                <div>
                  <span />À vous de jouer
                  <span />
                </div>
              </div>
            )}
          </div>
          <div className="checkout-bottom">
            <div className="cart-subtotal">
              <span>
                Sous-total{" "}
                <small>
                  ({itemCount} article{itemCount !== 1 ? "s" : ""})
                </small>
              </span>
              <strong>{money(subtotal)}</strong>
            </div>
            {can("edit", "pos") && (
              <div className="discount-section">
                <button
                  className="text-button"
                  disabled={!cart.length || busy}
                  onClick={() => setShowDiscount(!showDiscount)}
                >
                  <Tag size={14} />
                  {showDiscount ? "Retirer la remise" : "Ajouter une remise"}
                  <Plus size={12} />
                </button>
                {showDiscount && (
                  <div className="discount-input">
                    <input
                      type="number"
                      min="0"
                      max={subtotal}
                      step="0.01"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      aria-label="Remise en DA"
                    />
                    <span>DA</span>
                  </div>
                )}
              </div>
            )}
            <div className="cart-total">
              <strong>Total à payer</strong>
              <span>{money(total)}</span>
            </div>
            <div className="payment-label">MODE DE PAIEMENT</div>
            <div className="payment-methods">
              {[
                { name: "Espèces", icon: Banknote },
                { name: "Carte bancaire", label: "Carte", icon: CreditCard },
                { name: "Autre", icon: MoreHorizontal },
              ].map((p) => (
                <button
                  key={p.name}
                  className={payment === p.name ? "active" : ""}
                  onClick={() => setPayment(p.name)}
                  disabled={busy}
                >
                  <p.icon size={18} />
                  <span>{p.label || p.name}</span>
                  {payment === p.name && <Check size={11} />}
                </button>
              ))}
            </div>
            {payment === "Espèces" && (
              <>
                <label className="received-field">
                  <span>Montant reçu</span>
                  <div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={received}
                      onChange={(e) => setReceived(e.target.value)}
                      disabled={busy || !cart.length}
                      aria-label="Montant reçu"
                    />
                    <span>DA</span>
                    {cart.length > 0 && (
                      <button
                        onClick={() => setReceived(String(total))}
                        disabled={busy}
                        title="Montant exact"
                      >
                        Exact
                      </button>
                    )}
                  </div>
                </label>
                <div
                  className={`change-row ${change > 0 && cart.length ? "has-change" : ""}`}
                >
                  <span>
                    {change < 0 && received
                      ? "Reste à recevoir"
                      : "Monnaie à rendre"}
                  </span>
                  <strong>
                    {money(
                      change < 0 && received ? -change : Math.max(0, change),
                    )}
                  </strong>
                </div>
              </>
            )}
            <button
              className="button button-primary checkout-button"
              disabled={
                !cart.length ||
                busy ||
                !can("complete", "pos") ||
                discountValue > subtotal ||
                (payment === "Espèces" && Number(received) < total)
              }
              onClick={() => void checkout()}
            >
              <ShieldCheck size={18} />
              {busy ? "Encaissement…" : "Encaisser la commande"}
              <ArrowRight size={18} />
            </button>
            {can("create", "pos") && (
              <button
                className="hold-button"
                disabled={!cart.length || busy}
                onClick={() => void checkout(true)}
              >
                <Clock3 size={14} />
                Mettre en attente
              </button>
            )}
            <div className="checkout-security">
              <ShieldCheck size={12} />
              Vente sécurisée · Stock mis à jour automatiquement
            </div>
          </div>
        </aside>
      </div>
      {custom && (
        <Modal
          title={custom.name}
          subtitle="Un peu plus de vous dans chaque commande."
          onClose={() => setCustom(null)}
        >
          <div className="product-customizer">
            {custom.image && (
              <img
                className="customizer-image"
                src={custom.image}
                alt={custom.name}
              />
            )}
            {custom.sizes.length > 0 && (
              <>
                <h3>Choisissez une taille</h3>
                <div className="size-options">
                  {custom.sizes.map((s) => (
                    <button
                      className={size === s.name ? "active" : ""}
                      key={s.name}
                      onClick={() => setSize(s.name)}
                    >
                      <strong>{s.name}</strong>
                      <span>{money(s.price)}</span>
                      {size === s.name && <Check size={15} />}
                    </button>
                  ))}
                </div>
              </>
            )}
            {custom.extras.length > 0 && (
              <>
                <h3>Un supplément ?</h3>
                <div className="extras-options">
                  {custom.extras.map((e) => (
                    <label key={e.name}>
                      <input
                        type="checkbox"
                        checked={extras.includes(e.name)}
                        onChange={() =>
                          setExtras((prev) =>
                            prev.includes(e.name)
                              ? prev.filter((n) => n !== e.name)
                              : [...prev, e.name],
                          )
                        }
                      />
                      <span>{e.name}</span>
                      <strong>+ {money(e.price)}</strong>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button
              className="button button-secondary"
              onClick={() => setCustom(null)}
            >
              Annuler
            </button>
            <button
              className="button button-primary"
              onClick={() => add(custom, size, extras)}
            >
              <Plus size={16} />
              Ajouter ·{" "}
              {money(
                (custom.sizes.find((s) => s.name === size)?.price ??
                  custom.price) +
                  extras.reduce(
                    (sum, name) =>
                      sum +
                      (custom.extras.find((e) => e.name === name)?.price || 0),
                    0,
                  ),
              )}
            </button>
          </div>
        </Modal>
      )}
      {sale && (
        <Modal
          title={
            sale.status === "Terminée"
              ? "C’est encaissé !"
              : "Commande mise en attente"
          }
          subtitle={
            sale.status === "Terminée"
              ? "Une commande de plus, une belle journée qui continue."
              : "Retrouvez-la dans Commandes pour suivre sa préparation."
          }
          onClose={() => setSale(null)}
        >
          <div className="sale-success">
            <span className="sale-success-icon">
              <CheckCheck size={34} />
            </span>
            <span className="eyebrow">{sale.number}</span>
            <h2>{money(sale.total)}</h2>
            <p>
              {sale.items.reduce((s, i) => s + i.quantity, 0)} article(s) ·{" "}
              {sale.payment}
            </p>
            {sale.status === "Terminée" && sale.payment === "Espèces" && (
              <div className="sale-change">
                Monnaie à rendre<strong>{money(sale.change)}</strong>
              </div>
            )}
            <Badge tone={sale.status === "Terminée" ? "green" : "gold"}>
              {sale.status === "Terminée"
                ? "Enregistrée et synchronisée"
                : "En attente"}
            </Badge>
          </div>
          <div className="modal-footer">
            <button
              className="button button-secondary"
              onClick={() => printReceipt(sale)}
            >
              <Printer size={16} />
              Imprimer le ticket
            </button>
            <button
              className="button button-primary"
              onClick={() => setSale(null)}
            >
              Nouvelle commande
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
      {clearConfirm && (
        <Modal
          title="Vider la commande en cours ?"
          subtitle="Les articles du panier seront retirés. Aucune vente n’a encore été enregistrée."
          onClose={() => setClearConfirm(false)}
        >
          <div className="modal-footer">
            <button
              className="button button-secondary"
              onClick={() => setClearConfirm(false)}
            >
              Conserver
            </button>
            <button
              className="button button-danger"
              onClick={() => {
                setCart([]);
                newCheckoutKey();
                setClearConfirm(false);
                setReceived("");
              }}
            >
              Vider le panier
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
