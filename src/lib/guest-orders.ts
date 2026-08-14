export type GuestOrder = {
  token: string;
  order_number: number | null;
  created_at: string;
};

const KEY = "krunshy_guest_orders";
const MAX = 50;

export function readGuestOrders(): GuestOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((o): o is GuestOrder => Boolean(o && typeof (o as GuestOrder).token === "string"));
  } catch {
    return [];
  }
}

export function addGuestOrder(entry: GuestOrder) {
  if (typeof window === "undefined") return;
  try {
    const list = readGuestOrders().filter((o) => o.token !== entry.token);
    list.unshift(entry);
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* storage unavailable */
  }
}

export function hasGuestOrders() {
  return readGuestOrders().length > 0;
}
