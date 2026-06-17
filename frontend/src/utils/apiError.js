// Traduit le code d'erreur renvoyé par l'API (`error.response.data.error.code`)
// en message utilisateur localisé. Ne jamais afficher `error.message` brut
// (fuite de détails internes) — toujours passer par cette fonction.
export function getErrorMessage(error, t) {
  const code = error?.response?.data?.error?.code;
  const translated = code ? t(`errors.${code}`, { defaultValue: "" }) : "";
  return translated || t("errors.GENERIC");
}
