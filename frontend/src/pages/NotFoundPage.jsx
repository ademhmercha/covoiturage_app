import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "./pages.css";

export default function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="container not-found">
      <p className="not-found__code">404</p>
      <h1>{t("notFound.title")}</h1>
      <p className="text-muted">{t("notFound.body")}</p>
      <Link to="/" className="btn btn-primary">
        {t("notFound.backHome")}
      </Link>
    </div>
  );
}
