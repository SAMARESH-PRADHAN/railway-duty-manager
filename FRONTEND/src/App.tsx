// src/App.tsx
import { Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppLayout } from "@/components/AppLayout";
import { DataProvider } from "@/context/DataContext";
import { DataLoader } from "./components/DataLoader";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import Dashboard from "@/routes/index";
import EmployeesPage from "@/routes/employees";
import TrainsPage from "@/routes/trains";
import DutyPage from "@/routes/duty";
import RecordsPage from "@/routes/records";
import ReportsPage from "@/routes/reports";
import BatchesPage from "@/routes/batches";
import DesignationGroupManagementPage from "@/routes/designation-group-management";

function NotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  // reset scroll on route change
  if (typeof window !== "undefined") {
    // noop; BrowserRouter handles history. Kept for future enhancements.
    void location.pathname;
  }
  return (
    <DataProvider>
      <DataLoader>
        <ConfirmProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/employees" element={<EmployeesPage />} />
              <Route path="/trains" element={<TrainsPage />} />
              <Route path="/duty" element={<DutyPage />} />
              <Route path="/records" element={<RecordsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="*" element={<NotFound />} />
              <Route path="/batches" element={<BatchesPage />} />
              <Route
                path="/designation-group-management"
                element={<DesignationGroupManagementPage />}
              />
            </Routes>
            <Toaster richColors position="top-right" />
          </AppLayout>
        </ConfirmProvider>
      </DataLoader>
    </DataProvider>
  );
}
