import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./Router";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toast } from "@/components/ui/Toast";
import "./Styles.css";

const convexUrl = import.meta.env.VITE_CONVEX_URL;
const client = convexUrl ? new ConvexReactClient(convexUrl) : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      {client ? (
        <ConvexAuthProvider client={client} shouldHandleCode={false}>
          <RouterProvider router={router} />
        </ConvexAuthProvider>
      ) : (
        <main className="scaffold">
          <h1>Project scaffold</h1>
          <p>React + Vite + TypeScript + Intent UI</p>
          <p>Run backend setup, then restart the frontend to connect Convex.</p>
        </main>
      )}
      <Toast />
    </ThemeProvider>
  </StrictMode>,
);
