import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
  useLocation,
  useParams,
} from "react-router-dom";

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
import {
  AdminContractAlertsPage,
  AdminContractEventsPage,
  AdminContractIngestPage,
  AdminContractLayout,
  AdminContractMilestonesPage,
  AdminContractOverviewPage,
  AdminContractTestingPage,
} from "./pages/simulator/AdminContractPages";
import { SimulatorGuide } from "./pages/simulator/SimulatorGuide";
import { SimulatorIndex } from "./pages/simulator/SimulatorIndex";
import { SimulatorLayout } from "./pages/simulator/SimulatorLayout";
import { SystemHealthPage } from "./pages/simulator/SystemHealthPage";

const simulatorEnabled =
  import.meta.env.DEV && import.meta.env.VITE_ENABLE_SIMULATOR !== "false";

function LegacySimulatorRedirect() {
  const { contractId } = useParams();
  const location = useLocation();

  if (location.pathname === "/simulator" || location.pathname === "/simulator/") {
    return <Navigate replace to="/admin" />;
  }
  if (location.pathname === "/simulator/guide") {
    return <Navigate replace to="/admin/guide" />;
  }
  if (location.pathname === "/simulator/system") {
    return <Navigate replace to="/admin/system" />;
  }
  if (contractId) {
    return <Navigate replace to={`/admin/contracts/${contractId}/overview`} />;
  }
  return <Navigate replace to="/admin" />;
}

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
                  path: "admin",
                  element: <SimulatorLayout />,
                  children: [
                    {
                      index: true,
                      element: <SimulatorIndex />,
                    },
                    {
                      path: "guide",
                      element: <SimulatorGuide />,
                    },
                    {
                      path: "system",
                      element: <SystemHealthPage />,
                    },
                    {
                      path: "contracts/:contractId",
                      element: <AdminContractLayout />,
                      children: [
                        {
                          index: true,
                          element: <Navigate replace to="overview" />,
                        },
                        {
                          path: "overview",
                          element: <AdminContractOverviewPage />,
                        },
                        {
                          path: "ingest",
                          element: <AdminContractIngestPage />,
                        },
                        {
                          path: "alerts",
                          element: <AdminContractAlertsPage />,
                        },
                        {
                          path: "milestones",
                          element: <AdminContractMilestonesPage />,
                        },
                        {
                          path: "events",
                          element: <AdminContractEventsPage />,
                        },
                        {
                          path: "testing",
                          element: <AdminContractTestingPage />,
                        },
                        {
                          path: "*",
                          element: <Navigate replace to="overview" />,
                        },
                      ],
                    },
                    {
                      path: "*",
                      element: (
                        <NotFoundPage
                          actionLabel="Open admin"
                          actionTo="/admin"
                          description="That admin route does not exist."
                          title="Page not found"
                        />
                      ),
                    },
                  ],
                },
                {
                  path: "simulator",
                  element: <LegacySimulatorRedirect />,
                },
                {
                  path: "simulator/guide",
                  element: <LegacySimulatorRedirect />,
                },
                {
                  path: "simulator/system",
                  element: <LegacySimulatorRedirect />,
                },
                {
                  path: "simulator/:contractId",
                  element: <LegacySimulatorRedirect />,
                },
                {
                  path: "simulator/:contractId/*",
                  element: <LegacySimulatorRedirect />,
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
