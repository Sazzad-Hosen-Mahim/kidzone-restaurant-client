import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MenuBoardItem } from '@/types/api';

/**
 * The restaurant order in progress.
 *
 * It lives in Redux rather than component state so a cashier can walk away from
 * the till screen — to check a customer, to look at the menu list — and come
 * back to the same order. It is deliberately **not** persisted to storage: a
 * half-built order surviving a browser restart hours later is more likely to be
 * rung up by mistake than to be wanted.
 *
 * Prices here are a snapshot for display and preview only. The server reads its
 * own prices when the order is submitted, so a stale cart cannot underpay.
 */
export interface CartLine {
  menuItemId: string;
  name: string;
  categoryName: string;
  /** Poisha, as shown on the board when the line was added. */
  unitPrice: number;
  quantity: number;
  note?: string;
}

export interface CartState {
  lines: CartLine[];
  tableNo: string;
  customerPhone: string;
  customerName: string;
  /** Poisha off the subtotal. */
  discountAmount: number;
  discountReason: string;
}

const initialState: CartState = {
  lines: [],
  tableNo: '',
  customerPhone: '',
  customerName: '',
  discountAmount: 0,
  discountReason: '',
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    itemAdded(state, action: PayloadAction<{ item: MenuBoardItem; categoryName: string }>) {
      const { item, categoryName } = action.payload;
      const existing = state.lines.find((line) => line.menuItemId === item.id && !line.note);

      // Tapping the same dish again bumps the quantity rather than adding a
      // second line — unless the existing line carries a kitchen note, which
      // makes it a different thing to send.
      if (existing) {
        existing.quantity += 1;
        return;
      }

      state.lines.push({
        menuItemId: item.id,
        name: item.name,
        categoryName,
        unitPrice: item.price,
        quantity: 1,
      });
    },

    quantityChanged(state, action: PayloadAction<{ index: number; quantity: number }>) {
      const line = state.lines[action.payload.index];
      if (!line) return;

      const quantity = Math.max(0, Math.min(999, Math.trunc(action.payload.quantity)));
      if (quantity === 0) state.lines.splice(action.payload.index, 1);
      else line.quantity = quantity;
    },

    lineNoteChanged(state, action: PayloadAction<{ index: number; note: string }>) {
      const line = state.lines[action.payload.index];
      if (line) line.note = action.payload.note || undefined;
    },

    lineRemoved(state, action: PayloadAction<number>) {
      state.lines.splice(action.payload, 1);
    },

    tableChanged(state, action: PayloadAction<string>) {
      state.tableNo = action.payload;
    },

    customerChanged(state, action: PayloadAction<{ phone: string; name?: string }>) {
      state.customerPhone = action.payload.phone;
      if (action.payload.name !== undefined) state.customerName = action.payload.name;
    },

    discountChanged(state, action: PayloadAction<{ amount: number; reason: string }>) {
      state.discountAmount = Math.max(0, Math.trunc(action.payload.amount));
      state.discountReason = action.payload.reason;
    },

    cartCleared() {
      return initialState;
    },
  },
});

export const {
  itemAdded,
  quantityChanged,
  lineNoteChanged,
  lineRemoved,
  tableChanged,
  customerChanged,
  discountChanged,
  cartCleared,
} = cartSlice.actions;

export const cartReducer = cartSlice.reducer;
