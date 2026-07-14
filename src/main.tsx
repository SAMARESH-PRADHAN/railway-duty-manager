import "./styles.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { DataProvider } from "@/context/DataContext";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <DataProvider>
          <ConfirmProvider>
            <App />
            <Toaster richColors position="top-right" />
          </ConfirmProvider>
        </DataProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
