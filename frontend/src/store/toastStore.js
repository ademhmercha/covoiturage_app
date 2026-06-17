import { create } from "zustand";

const useToastStore = create((set) => ({
  toasts: [],
  unreadMessages: 0,

  addToast: ({ message, type = "info", duration = 4000, action }) =>
    set((state) => {
      const id = crypto.randomUUID();
      return { toasts: [...state.toasts, { id, message, type, duration, action }] };
    }),

  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

  incrementUnread: () =>
    set((state) => ({ unreadMessages: state.unreadMessages + 1 })),

  clearUnread: () => set({ unreadMessages: 0 }),
}));

export default useToastStore;
