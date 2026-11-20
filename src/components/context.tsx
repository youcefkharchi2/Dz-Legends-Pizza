"use client";
import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { State, Page, Order, User, CartItem } from "@/lib/types";
export type EditorKind =
  "product" | "category" | "stock" | "expense" | "employee" | "movement";
export type Draft = Record<string, any>;
export interface AppContextType {
  cart: CartItem[];
  setCart: Dispatch<SetStateAction<CartItem[]>>;
  checkoutKey: string;
  newCheckoutKey: () => void;
  state: State;
  page: Page;
  navigate: (page: Page) => void;
  refresh: () => Promise<void>;
  request: <T = Record<string, unknown>>(
    url: string,
    body?: unknown,
    method?: string,
  ) => Promise<T>;
  notify: (message: string, type?: "success" | "error") => void;
  ensureAuth: () => boolean;
  can: (action: string, page?: Page) => boolean;
  edit: (kind: EditorKind, item?: Draft) => void;
  remove: (kind: EditorKind, item: Draft) => void;
  printReceipt: (order: Order) => void;
  theme: string;
  toggleTheme: () => void;
  openLogin: () => void;
  user: User | null;
}
export const AppContext = createContext<AppContextType | null>(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("App context missing");
  return ctx;
}
