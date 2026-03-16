import { isRouteErrorResponse, useRouteError } from "react-router-dom";

import { NotFoundPage } from "./NotFoundPage";

export function RouteErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      return (
        <NotFoundPage
          actionLabel="Back to contracts"
          actionTo="/contracts"
          description="The page you requested does not exist or is no longer available."
          title="Page not found"
        />
      );
    }

    return (
      <section className="app-shell status-shell">
        <div className="status-card error-card">
          <span className="eyebrow">Route error</span>
          <h1>
            {error.status} {error.statusText}
          </h1>
          <p>{typeof error.data === "string" ? error.data : "A route-level error interrupted the dashboard."}</p>
        </div>
      </section>
    );
  }

  const message = error instanceof Error ? error.message : "An unexpected route error occurred.";

  return (
    <section className="app-shell status-shell">
      <div className="status-card error-card">
        <span className="eyebrow">Route error</span>
        <h1>Something went wrong while rendering the dashboard</h1>
        <p>{message}</p>
      </div>
    </section>
  );
}
