import { useTranslation } from "react-i18next";

export default function LoadingScreen() {
  const { t } = useTranslation();

  return (
    <div className="page">
      <div className="container text-center text-muted">
        <span className="spinner" /> {t("common.loading")}
      </div>
    </div>
  );
}
