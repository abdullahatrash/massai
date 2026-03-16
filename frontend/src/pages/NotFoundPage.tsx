import { Link } from "react-router-dom";

type NotFoundPageProps = {
  actionLabel?: string;
  actionTo?: string;
  description?: string;
  title?: string;
};

export function NotFoundPage({
  actionLabel = "Open contracts",
  actionTo = "/contracts",
  description = "The page you requested does not exist or is no longer available.",
  title = "Page not found",
}: NotFoundPageProps) {
  return (
    <section className="page-stack">
      <div className="content-card error-card not-found-card">
        <span className="eyebrow">404</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <Link className="primary-button scaffold-link" to={actionTo}>
          {actionLabel}
        </Link>
      </div>
    </section>
  );
}
