const STORAGE_KEY = "wasel-theme";

function resolveInitial() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved !== null) return saved === "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

import { useEffect, useState } from "react";

export default function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const initial = resolveInitial();
    // Apply immediately to prevent flash before first paint
    document.documentElement.dataset.theme = initial ? "dark" : "light";
    return initial;
  });

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  }, [dark]);

  return [dark, setDark];
}
