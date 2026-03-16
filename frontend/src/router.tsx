import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ContractAlertsPage } from "./pages/ContractAlertsPage";
import { ContractAnalyticsPage } from "./pages/ContractAnalyticsPage";
import { ContractDocumentsPage } from "./pages/ContractDocumentsPage";
import { ContractFeedPage } from "./pages/ContractFeedPage";
import { ContractMilestonesPage } from "./pages/ContractMilestonesPage";
import { ContractOverviewPage } from "./pages/ContractOverviewPage";
import { ContractRouteLayout } from "./pages/ContractRouteLayout";
import { ContractsList } from "./pages/ContractsList";
import { NotFoundPage } from "./pages/NotFoundPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { RouteErrorBoundary } from "./pages/RouteErrorBoundary";
import { ContractSimulator } from "./pages/simulator/ContractSimulator";
import { SimulatorIndex } from "./pages/simulator/SimulatorIndex";
import { SimulatorLayout } from "./pages/simulator/SimulatorLayout";

const simulatorEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_SIMULATOR !== "false";

const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <Navigate replace to="contracts" />,
          },
          {
            path: "contracts",
            children: [
              {
                index: true,
                element: <ContractsList />,
              },
              {
                path: ":contractId",
                element: <ContractRouteLayout />,
                children: [
                  {
                    index: true,
                    element: <ContractOverviewPage />,
                  },
                  {
                    path: "milestones",
                    element: <ContractMilestonesPage />,
                  },
                  {
                    path: "feed",
                    element: <ContractFeedPage />,
                  },
                  {
                    path: "alerts",
                    element: <ContractAlertsPage />,
                  },
                  {
                    path: "documents",
                    element: <ContractDocumentsPage />,
                  },
                  {
                    path: "analytics",
                    element: <ContractAnalyticsPage />,
                  },
                  {
                    path: "*",
                    element: (
                      <NotFoundPage
                        actionLabel="Back to contracts"
                        actionTo="/contracts"
                        description="That contract subsection is not part of the dashboard route map."
                        title="Page not found"
                      />
                    ),
                  },
                ],
              },
            ],
          },
          {
            path: "notifications",
            element: <NotificationsPage />,
          },
          {
            path: "*",
            element: (
              <NotFoundPage
                actionLabel="Open contracts"
                actionTo="/contracts"
                description="The route you requested does not exist in the consumer dashboard."
                title="Page not found"
              />
            ),
          },
        ],
      },
      ...(simulatorEnabled
        ? [
            {
              element: <ProtectedRoute requiredRole="admin" />,
              children: [
                {
                  path: "simulator",
                  element: <SimulatorLayout />,
                  children: [
                    {
                      index: true,
                      element: <SimulatorIndex />,
                    },
                    {
                      path: ":contractId",
                      element: <ContractSimulator />,
                    },
                    {
                      path: "*",
                      element: (
                        <NotFoundPage
                          actionLabel="Open simulator"
                          actionTo="/simulator"
                          description="That simulator route does not exist."
                          title="Page not found"
                        />
                      ),
                    },
                  ],
                },
              ],
            },
          ]
        : []),
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
