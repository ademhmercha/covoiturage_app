export function formatDateTime(date, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(date));
}

export function formatDate(date, locale) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(date));
}
