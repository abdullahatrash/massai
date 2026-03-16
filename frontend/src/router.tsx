import { Navigate, RouterProvider, createBrowserRouter } from "react-router-dom";

import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { ContractsPage } from "./pages/ContractsPage";
import { SimulatorPage } from "./pages/SimulatorPage";

const router = createBrowserRouter([
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <DashboardLayout />,
        children: [
          {
            index: true,
            element: <Navigate replace to="/contracts" />,
          },
          {
            path: "/contracts",
            element: <ContractsPage />,
          },
          {
            element: <ProtectedRoute requiredRole="admin" />,
            children: [
              {
                path: "/simulator",
                element: <SimulatorPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
