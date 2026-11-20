export const PAGES = [
  "dashboard",
  "pos",
  "orders",
  "products",
  "categories",
  "stock",
  "expenses",
  "reports",
  "employees",
  "settings",
] as const;
export type Page = (typeof PAGES)[number];
export const PAGE_LABELS: Record<Page, string> = {
  dashboard: "Tableau de bord",
  pos: "Caisse POS",
  orders: "Commandes",
  products: "Produits",
  categories: "Catégories",
  stock: "Stock",
  expenses: "Dépenses",
  reports: "Rapports",
  employees: "Employés",
  settings: "Paramètres",
};
export const ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "complete",
  "cancel",
  "finance",
] as const;
export const ACTION_LABELS: Record<string, string> = {
  view: "Consulter",
  create: "Créer",
  edit: "Modifier",
  delete: "Supprimer",
  complete: "Encaisser une vente",
  cancel: "Annuler / rembourser",
  finance: "Voir les finances",
};
export interface User {
  id: string;
  name: string;
  username: string;
  role: string;
  active: boolean;
  isOwner: boolean;
  pages: string[];
  actions: string[];
}
export interface Base {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export interface Recipe {
  stockId: string;
  quantity: number;
}
export interface Option {
  name: string;
  price: number;
  cost?: number;
}
export interface Product extends Base {
  name: string;
  categoryId: string;
  price: number;
  cost: number;
  enabled: boolean;
  image: string;
  recipe: Recipe[];
  sizes: Option[];
  extras: Option[];
}
export interface Category extends Base {
  name: string;
  image: string;
  order: number;
}
export interface StockItem extends Base {
  name: string;
  quantity: number;
  unit: string;
  min: number;
  cost: number;
  supplier: string;
  image: string;
}
export interface Expense extends Base {
  description: string;
  amount: number;
  category: string;
  date: string;
  employeeName: string;
  inventoryPurchase: boolean;
}
export type OrderStatus =
  "En attente" | "En préparation" | "Prête" | "Terminée" | "Annulée";
export const STATUSES: OrderStatus[] = [
  "En attente",
  "En préparation",
  "Prête",
  "Terminée",
  "Annulée",
];
export interface CartItem {
  categoryId?: string;
  categoryName?: string;
  key: string;
  productId: string;
  name: string;
  image: string;
  quantity: number;
  price: number;
  size: string;
  extras: string[];
  cost?: number;
  recipe?: Recipe[];
}
export interface Order extends Base {
  number: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  cogs: number;
  payment: string;
  received: number;
  change: number;
  employeeId: string;
  employeeName: string;
  status: OrderStatus;
  stockDeducted: boolean;
}
export interface Movement extends Base {
  stockId: string;
  name: string;
  delta: number;
  unit: string;
  reason: string;
  date: string;
  employeeName: string;
  orderId?: string;
}
export interface Settings {
  name: string;
  address: string;
  phone: string;
  currency: string;
  footer: string;
  receiptWidth: string;
  allowNegative: boolean;
  autoBackup: boolean;
  logo: string;
  theme: string;
}
export const DEFAULT_SETTINGS: Settings = {
  name: "DZ Legends Pizza",
  address: "",
  phone: "",
  currency: "DA",
  footer: "Merci de votre visite. À très bientôt !",
  receiptWidth: "80",
  allowNegative: false,
  autoBackup: true,
  logo: "",
  theme: "dark",
};
export interface State {
  setup: boolean;
  user: User | null;
  products: Product[];
  categories: Category[];
  stock: StockItem[];
  expenses: Expense[];
  orders: Order[];
  movements: Movement[];
  employees: User[];
  settings: Settings;
  lastSync: string;
  lastBackup: string | null;
}
export const EMPTY_STATE: State = {
  setup: true,
  user: null,
  products: [],
  categories: [],
  stock: [],
  expenses: [],
  orders: [],
  movements: [],
  employees: [],
  settings: DEFAULT_SETTINGS,
  lastSync: "",
  lastBackup: null,
};
export const money = (value: number) =>
  new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 2 }).format(value) +
  " DA";
export const dateKey = (value: Date | string) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export function financials(state: State, from?: string, to?: string) {
  const inRange = (date: string) =>
    (!from || dateKey(date) >= from) && (!to || dateKey(date) <= to);
  const sales = state.orders.filter(
    (o) => o.status === "Terminée" && inRange(o.date),
  );
  const revenue = sales.reduce((s, o) => s + o.total, 0);
  const cogs = sales.reduce((s, o) => s + o.cogs, 0);
  const expenses = state.expenses
    .filter((e) => !e.inventoryPurchase && inRange(e.date))
    .reduce((s, e) => s + e.amount, 0);
  return { sales, revenue, cogs, expenses, profit: revenue - cogs - expenses };
}
