import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { OrganizationProvider } from "./context/OrganizationContext";
import CorporateLayout from "./components/layout/CorporateLayout";
import DemoLayout from "./components/layout/DemoLayout";
import RequireAuth from "./components/auth/RequireAuth";
import CorporateHome from "./routes/CorporateHome";
import DemoHub from "./routes/DemoHub";
import ContractPortfolio from "./routes/ContractPortfolio";
import ContractWorkspace from "./routes/ContractWorkspace";
import AnalysisView from "./routes/AnalysisView";
import Login from "./routes/Login";
import PlaceholderPage from "./routes/PlaceholderPage";

export default function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<CorporateLayout />}>
              <Route path="/" element={<CorporateHome />} />
              <Route
                path="/product"
                element={
                  <PlaceholderPage
                    title="Product"
                    description="A closer look at Contract Intelligence is coming here — this page is a structural placeholder for the next implementation phase."
                  />
                }
              />
              <Route
                path="/aviation"
                element={
                  <PlaceholderPage
                    title="Aviation"
                    description="Aviation-specific detail for airlines, lessors, MRO, ground handling and airport operators is coming here."
                  />
                }
              />
              <Route
                path="/how-it-works"
                element={
                  <PlaceholderPage
                    title="How it works"
                    description="A walkthrough of the upload → analysis → intelligence pipeline is coming here."
                  />
                }
              />
              <Route
                path="/about"
                element={
                  <PlaceholderPage
                    title="About Operion"
                    description="Our vision for aviation contract intelligence and predictive scenario simulation."
                  />
                }
              />
              <Route path="/login" element={<Login />} />
            </Route>

            <Route element={<DemoLayout />}>
              <Route
                path="/demo"
                element={
                  <RequireAuth>
                    <DemoHub />
                  </RequireAuth>
                }
              />
              <Route
                path="/demo/contracts"
                element={
                  <RequireAuth>
                    <ContractPortfolio />
                  </RequireAuth>
                }
              />
              <Route
                path="/demo/contracts/:id"
                element={
                  <RequireAuth>
                    <ContractWorkspace />
                  </RequireAuth>
                }
              />
              <Route
                path="/demo/contracts/:id/analysis"
                element={
                  <RequireAuth>
                    <AnalysisView />
                  </RequireAuth>
                }
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </OrganizationProvider>
    </AuthProvider>
  );
}
