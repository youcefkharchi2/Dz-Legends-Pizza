"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  Camera,
  Upload,
  X,
  Plus,
  Trash2,
  ImagePlus,
  Info,
  Save,
  Package,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { useApp, type EditorKind, type Draft } from "./context";
import { Field, Modal } from "./ui";
import {
  ACTIONS,
  ACTION_LABELS,
  PAGES,
  PAGE_LABELS,
  dateKey,
  money,
} from "@/lib/types";
const labels: Record<EditorKind, string> = {
  product: "produit",
  category: "catégorie",
  stock: "ingrédient",
  expense: "dépense",
  employee: "employé",
  movement: "mouvement de stock",
};
const rolePresets: Record<string, { pages: string[]; actions: string[] }> = {
  Administrateur: { pages: [...PAGES], actions: [...ACTIONS] },
  Manager: {
    pages: PAGES.filter((p) => !["employees", "settings"].includes(p)),
    actions: ["view", "create", "edit", "complete", "cancel", "finance"],
  },
  Caissier: {
    pages: ["pos", "orders"],
    actions: ["view", "create", "complete"],
  },
  Personnalisé: { pages: [], actions: ["view"] },
};
export function ImageUpload({
  value,
  onChange,
  page,
}: {
  value: string;
  onChange: (v: string) => void;
  page: string;
}) {
  const { notify } = useApp();
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const change = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      notify("L’image doit faire moins de 5 Mo.", "error");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("page", page);
      const r = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      onChange(data.url);
    } catch (e) {
      notify((e as Error).message, "error");
    } finally {
      URL.revokeObjectURL(url);
      setPreview("");
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <div className="image-upload">
      <div className="image-preview">
        {preview || value ? (
          <img src={preview || value} alt="Aperçu de l’image" />
        ) : (
          <ImagePlus size={29} strokeWidth={1.3} />
        )}
        {uploading && <span className="upload-spinner" />}
      </div>
      <div>
        <strong>
          {page === "settings"
            ? "Logo de votre établissement"
            : "Une belle image fait la différence"}
        </strong>
        <p>PNG, JPG ou WebP · 5 Mo maximum</p>
        <div className="upload-actions">
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => input.current?.click()}
            disabled={uploading}
          >
            <Upload size={14} />
            {uploading
              ? "Envoi en cours…"
              : value
                ? "Remplacer l’image"
                : "Choisir une image"}
          </button>
          {value && (
            <button
              type="button"
              className="plain-button text-red"
              onClick={() => onChange("")}
              disabled={uploading}
            >
              <X size={15} />
              Retirer
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(e) => void change(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
export function EntityEditor({
  kind,
  item,
  onClose,
}: {
  kind: EditorKind;
  item?: Draft;
  onClose: () => void;
}) {
  const { state, request, refresh, notify } = useApp();
  const isEdit = !!item?.id;
  const defaults: Record<EditorKind, Draft> = {
    product: {
      name: "",
      categoryId: "",
      price: "",
      cost: 0,
      enabled: true,
      image: "",
      recipe: [],
      sizes: [],
      extras: [],
    },
    category: { name: "", image: "", order: state.categories.length + 1 },
    stock: {
      name: "",
      quantity: 0,
      unit: "kg",
      min: 0,
      cost: 0,
      supplier: "",
      image: "",
    },
    expense: {
      description: "",
      amount: "",
      category: "Autre",
      date: dateKey(new Date()),
      inventoryPurchase: false,
    },
    employee: {
      name: "",
      username: "",
      password: "",
      role: "Caissier",
      active: true,
      ...rolePresets.Caissier,
    },
    movement: {
      stockId: item?.stockId || state.stock[0]?.id || "",
      direction: "in",
      quantity: "",
      reason: "Réapprovisionnement",
      purchaseCost: "",
    },
  };
  const [draft, setDraft] = useState<Draft>({ ...defaults[kind], ...item });
  const [sizeText, setSizeText] = useState(
    (item?.sizes || []).map((s: Draft) => `${s.name} | ${s.price}`).join("\n"),
  );
  const [extrasText, setExtrasText] = useState(
    (item?.extras || [])
      .map((s: Draft) => `${s.name} | ${s.price} | ${s.cost || 0}`)
      .join("\n"),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key: string, value: unknown) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const toggle = (key: string, value: string) =>
    update(
      key,
      draft[key].includes(value)
        ? draft[key].filter((v: string) => v !== value)
        : [...draft[key], value],
    );
  const parseOptions = (text: string, extras = false) =>
    text
      .split("\n")
      .filter((s) => s.trim())
      .map((line) => {
        const [name, price, cost] = line.split("|").map((s) => s.trim());
        if (
          !name ||
          price === undefined ||
          !Number.isFinite(Number(price)) ||
          Number(price) < 0 ||
          (extras &&
            (cost === undefined ||
              !Number.isFinite(Number(cost)) ||
              Number(cost) < 0))
        )
          throw new Error(
            "Options : utilisez le format Nom | Prix" +
              (extras ? " | Coût" : ""),
          );
        return {
          name,
          price: Number(price),
          cost: extras ? Number(cost || 0) : 0,
        };
      });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (kind === "movement") {
        const stock = state.stock.find((s) => s.id === draft.stockId);
        await request("/api/operations", {
          action: "movement",
          ...draft,
          version: stock?.version,
        });
      } else {
        const data = { ...draft };
        if (kind === "product") {
          data.sizes = parseOptions(sizeText);
          data.extras = parseOptions(extrasText, true);
        }
        await request(
          kind === "employee" ? "/api/employees" : "/api/entities",
          { kind, id: item?.id, version: item?.version, data },
          isEdit ? "PUT" : "POST",
        );
      }
      await refresh();
      notify(
        kind === "movement"
          ? "Mouvement enregistré. Stock mis à jour."
          : isEdit
            ? "Modifications enregistrées."
            : "Élément ajouté avec succès.",
      );
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const recipeCost =
    kind === "product"
      ? (draft.recipe || []).reduce(
          (sum: number, r: Draft) =>
            sum +
            (state.stock.find((s) => s.id === r.stockId)?.cost || 0) *
              Number(r.quantity || 0),
          0,
        )
      : 0;
  return (
    <Modal
      title={
        kind === "movement"
          ? "Enregistrer un mouvement"
          : `${isEdit ? "Modifier" : "Ajouter"} ${["category", "expense"].includes(kind) ? "une" : "un"} ${labels[kind]}`
      }
      subtitle={
        kind === "product"
          ? "Composez votre carte jusque dans les moindres détails."
          : kind === "employee"
            ? "Un compte personnel, des accès adaptés et un mot de passe sécurisé."
            : "Les données seront partagées dans tous vos navigateurs."
      }
      onClose={onClose}
      wide={["product", "employee"].includes(kind)}
      busy={busy}
    >
      <form onSubmit={(e) => void submit(e)}>
        <div className="editor-body">
          {["product", "category", "stock"].includes(kind) && (
            <ImageUpload
              value={draft.image}
              onChange={(v) => update("image", v)}
              page={
                kind === "product"
                  ? "products"
                  : kind === "category"
                    ? "categories"
                    : "stock"
              }
            />
          )}
          <div className="form-grid">
            {kind === "product" && (
              <>
                <Field label="Nom du produit *" full>
                  <input
                    value={draft.name}
                    onChange={(e) => update("name", e.target.value)}
                    required
                    placeholder="Le nom de votre spécialité"
                    maxLength={180}
                  />
                </Field>
                <Field label="Catégorie">
                  <select
                    value={draft.categoryId}
                    onChange={(e) => update("categoryId", e.target.value)}
                  >
                    <option value="">Sans catégorie</option>
                    {state.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Prix de vente (DA) *">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={draft.price}
                    onChange={(e) => update("price", e.target.value)}
                    placeholder="0,00"
                  />
                </Field>
                <Field
                  label="Coût direct (DA)"
                  hint={
                    draft.recipe.length
                      ? "La recette remplace ce coût dans le calcul des marges."
                      : "À renseigner si vous n’utilisez pas de recette."
                  }
                >
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.cost}
                    onChange={(e) => update("cost", e.target.value)}
                  />
                </Field>
                <div className="field">
                  <span>Disponibilité</span>
                  <label className="switch-row">
                    <input
                      type="checkbox"
                      checked={draft.enabled}
                      onChange={(e) => update("enabled", e.target.checked)}
                    />
                    <span className="switch" />
                    <span>Disponible à la caisse</span>
                  </label>
                </div>
              </>
            )}
            {kind === "category" && (
              <>
                <Field label="Nom de la catégorie *" full>
                  <input
                    required
                    value={draft.name}
                    maxLength={180}
                    onChange={(e) => update("name", e.target.value)}
                    placeholder="Le nom de votre catégorie"
                  />
                </Field>
                <Field
                  label="Ordre d’affichage"
                  full
                  hint="Les catégories sont affichées par ordre croissant."
                >
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={draft.order}
                    onChange={(e) => update("order", e.target.value)}
                  />
                </Field>
              </>
            )}
            {kind === "stock" && (
              <>
                <Field label="Nom de l’ingrédient ou article *" full>
                  <input
                    value={draft.name}
                    onChange={(e) => update("name", e.target.value)}
                    required
                    placeholder="Ex. Farine de blé"
                    maxLength={180}
                  />
                </Field>
                <Field
                  label={isEdit ? "Quantité actuelle" : "Quantité initiale *"}
                  hint={
                    isEdit
                      ? "Pour la changer, enregistrez un mouvement de stock."
                      : undefined
                  }
                >
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={draft.quantity}
                    onChange={(e) => update("quantity", e.target.value)}
                    disabled={isEdit}
                    required
                  />
                </Field>
                <Field label="Unité">
                  <select
                    value={draft.unit}
                    onChange={(e) => update("unit", e.target.value)}
                  >
                    {["kg", "g", "L", "ml", "pièces"].map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Coût d’achat par unité (DA) *">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={draft.cost}
                    onChange={(e) => update("cost", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Seuil de stock faible">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={draft.min}
                    onChange={(e) => update("min", e.target.value)}
                  />
                </Field>
                <Field label="Fournisseur" full>
                  <input
                    value={draft.supplier}
                    onChange={(e) => update("supplier", e.target.value)}
                    placeholder="Nom ou coordonnées du fournisseur"
                    maxLength={180}
                  />
                </Field>
                <div className="info-box field-full">
                  <Info size={17} />
                  <span>
                    Utilisez la même unité dans les recettes. Par exemple, 150 g
                    de farine = 0,15 kg si votre stock est en kg.
                  </span>
                </div>
              </>
            )}
            {kind === "expense" && (
              <>
                <Field label="Description *" full>
                  <input
                    value={draft.description}
                    onChange={(e) => update("description", e.target.value)}
                    required
                    placeholder="Précisez la dépense"
                    maxLength={180}
                  />
                </Field>
                <Field label="Montant (DA) *">
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={draft.amount}
                    onChange={(e) => update("amount", e.target.value)}
                    required
                    placeholder="0,00"
                  />
                </Field>
                <Field label="Date *">
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => update("date", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Catégorie" full>
                  <select
                    value={draft.category}
                    onChange={(e) => update("category", e.target.value)}
                  >
                    {[
                      "Ingrédients",
                      "Électricité",
                      "Eau",
                      "Loyer",
                      "Salaires",
                      "Maintenance",
                      "Autre",
                    ].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <label className="checkbox-card field-full">
                  <input
                    type="checkbox"
                    checked={draft.inventoryPurchase}
                    onChange={(e) =>
                      update("inventoryPurchase", e.target.checked)
                    }
                  />
                  <span>
                    <strong>Achat de stock déjà valorisé</strong>
                    <small>
                      Conserver pour le suivi de trésorerie sans le déduire une
                      seconde fois du bénéfice. Le coût sera compté à la vente
                      via la recette.
                    </small>
                  </span>
                </label>
              </>
            )}
            {kind === "movement" && (
              <>
                <Field label="Ingrédient *" full>
                  <select
                    value={draft.stockId}
                    onChange={(e) => update("stockId", e.target.value)}
                    required
                  >
                    <option value="">Choisir un ingrédient</option>
                    {state.stock.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.quantity} {s.unit}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Type de mouvement">
                  <select
                    value={draft.direction}
                    onChange={(e) => update("direction", e.target.value)}
                  >
                    <option value="in">Entrée de stock</option>
                    <option value="out">Sortie / consommation</option>
                  </select>
                </Field>
                <Field
                  label={`Quantité (${state.stock.find((s) => s.id === draft.stockId)?.unit || "unité"}) *`}
                >
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    required
                    value={draft.quantity}
                    onChange={(e) => update("quantity", e.target.value)}
                  />
                </Field>
                {draft.direction === "in" && (
                  <Field
                    label="Coût d’achat par unité (DA)"
                    full
                    hint="Facultatif : actualise le coût moyen pondéré de votre stock."
                  >
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={draft.purchaseCost}
                      onChange={(e) => update("purchaseCost", e.target.value)}
                      placeholder="Conserver le coût actuel"
                    />
                  </Field>
                )}
                <Field label="Motif *" full>
                  <input
                    value={draft.reason}
                    onChange={(e) => update("reason", e.target.value)}
                    required
                    placeholder="Ex. Réapprovisionnement fournisseur"
                    maxLength={180}
                  />
                </Field>
              </>
            )}
            {kind === "employee" && (
              <>
                <Field label="Nom complet *">
                  <input
                    value={draft.name}
                    onChange={(e) => update("name", e.target.value)}
                    required
                    maxLength={180}
                    placeholder="Prénom et nom"
                  />
                </Field>
                <Field label="Identifiant *">
                  <input
                    value={draft.username}
                    onChange={(e) => update("username", e.target.value)}
                    required
                    pattern="[A-Za-z0-9._-]+"
                    maxLength={60}
                    autoComplete="off"
                    placeholder="prenom.nom"
                  />
                </Field>
                <Field
                  label={isEdit ? "Nouveau mot de passe" : "Mot de passe *"}
                  hint={
                    isEdit
                      ? "Laissez vide pour conserver le mot de passe actuel."
                      : "10 caractères minimum."
                  }
                >
                  <input
                    type="password"
                    value={draft.password || ""}
                    onChange={(e) => update("password", e.target.value)}
                    minLength={10}
                    maxLength={128}
                    required={!isEdit}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Rôle">
                  <select
                    value={draft.role}
                    disabled={!!item?.isOwner}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        role: e.target.value,
                        ...rolePresets[e.target.value],
                      }))
                    }
                  >
                    {Object.keys(rolePresets).map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </Field>
                <label className="switch-row field-full">
                  <input
                    type="checkbox"
                    checked={draft.active}
                    disabled={!!item?.isOwner}
                    onChange={(e) => update("active", e.target.checked)}
                  />
                  <span className="switch" />
                  <span>Compte actif</span>
                </label>
              </>
            )}
          </div>
          {kind === "product" && (
            <>
              <div className="form-section-heading">
                <div>
                  <Package size={17} />
                  <h3>Recette & consommation du stock</h3>
                </div>
                <span>
                  {draft.recipe.length ? money(recipeCost) : "Facultatif"}
                </span>
              </div>
              <div className="recipe-list">
                {draft.recipe.map((r: Draft, i: number) => (
                  <div className="recipe-row" key={i}>
                    <select
                      required
                      value={r.stockId}
                      onChange={(e) =>
                        update(
                          "recipe",
                          draft.recipe.map((v: Draft, j: number) =>
                            j === i ? { ...v, stockId: e.target.value } : v,
                          ),
                        )
                      }
                    >
                      <option value="">Choisir un ingrédient</option>
                      {state.stock.map((s) => (
                        <option value={s.id} key={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0.000001"
                      step="any"
                      required
                      value={r.quantity}
                      onChange={(e) =>
                        update(
                          "recipe",
                          draft.recipe.map((v: Draft, j: number) =>
                            j === i ? { ...v, quantity: e.target.value } : v,
                          ),
                        )
                      }
                      placeholder="Quantité"
                    />
                    <span>
                      {state.stock.find((s) => s.id === r.stockId)?.unit || "—"}
                    </span>
                    <button
                      type="button"
                      className="icon-button danger-hover"
                      onClick={() =>
                        update(
                          "recipe",
                          draft.recipe.filter((_: Draft, j: number) => j !== i),
                        )
                      }
                      aria-label="Retirer l’ingrédient"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-button"
                disabled={!state.stock.length}
                onClick={() =>
                  update("recipe", [
                    ...draft.recipe,
                    { stockId: "", quantity: "" },
                  ])
                }
              >
                <Plus size={15} />
                Ajouter un ingrédient
              </button>
              {!state.stock.length && (
                <p className="field-hint">
                  Ajoutez d’abord vos ingrédients dans la page Stock.
                </p>
              )}
              <div className="form-section-heading">
                <div>
                  <Plus size={17} />
                  <h3>Tailles & suppléments</h3>
                </div>
                <span>Facultatif</span>
              </div>
              <div className="form-grid">
                <Field
                  label="Tailles et prix de vente"
                  hint="Une ligne par taille : Nom | Prix en DA"
                >
                  <textarea
                    rows={3}
                    value={sizeText}
                    onChange={(e) => setSizeText(e.target.value)}
                    placeholder={"Moyenne | 800\nGrande | 1200"}
                  />
                </Field>
                <Field
                  label="Suppléments, prix et coûts"
                  hint="Une ligne : Nom | Prix en DA | Coût en DA"
                >
                  <textarea
                    rows={3}
                    value={extrasText}
                    onChange={(e) => setExtrasText(e.target.value)}
                    placeholder={"Fromage | 150 | 60"}
                  />
                </Field>
              </div>
              <div className="info-box">
                <Info size={16} />
                <span>
                  La recette est déduite par unité vendue, quelle que soit la
                  taille. Pour une recette différente, créez un produit
                  distinct.
                </span>
              </div>
            </>
          )}
          {kind === "employee" && (
            <>
              <div className="form-section-heading">
                <div>
                  <ShieldCheck size={17} />
                  <h3>Pages accessibles</h3>
                </div>
                <span>
                  {draft.role === "Administrateur"
                    ? "Accès complet"
                    : "Personnalisable"}
                </span>
              </div>
              <div className="permissions-grid">
                {PAGES.map((p) => (
                  <label className="permission-checkbox" key={p}>
                    <input
                      type="checkbox"
                      checked={
                        draft.role === "Administrateur" ||
                        draft.pages.includes(p)
                      }
                      disabled={draft.role === "Administrateur"}
                      onChange={() => toggle("pages", p)}
                    />
                    <span>{PAGE_LABELS[p]}</span>
                  </label>
                ))}
              </div>
              <div className="form-section-heading">
                <div>
                  <ShieldCheck size={17} />
                  <h3>Actions autorisées</h3>
                </div>
              </div>
              <div className="permissions-grid">
                {ACTIONS.map((a) => (
                  <label className="permission-checkbox" key={a}>
                    <input
                      type="checkbox"
                      checked={
                        draft.role === "Administrateur" ||
                        draft.actions.includes(a)
                      }
                      disabled={draft.role === "Administrateur"}
                      onChange={() => toggle("actions", a)}
                    />
                    <span>{ACTION_LABELS[a]}</span>
                  </label>
                ))}
              </div>
              <p className="field-hint">
                La gestion des employés est toujours réservée aux
                administrateurs. Modifier un compte révoque ses sessions
                ouvertes.
              </p>
            </>
          )}
          {error && (
            <div className="form-error">
              <Info size={17} />
              {error}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={busy}
          >
            Annuler
          </button>
          <button className="button button-primary" disabled={busy}>
            <Save size={16} />
            {busy
              ? "Enregistrement…"
              : isEdit
                ? "Enregistrer les modifications"
                : "Enregistrer"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
