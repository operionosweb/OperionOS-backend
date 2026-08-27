import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import Platform from "./routes/Platform";
import Aviation from "./routes/Aviation";
import Scenarios from "./routes/Scenarios";
import Enterprise from "./routes/Enterprise";
import Solutions from "./routes/Solutions";
import About from "./routes/About";

export default function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<CorporateLayout />}>
              <Route path="/" element={<CorporateHome />} />
              <Route path="/platform" element={<Platform />} />
              <Route path="/industries/aviation" element={<Aviation />} />
              <Route path="/scenarios" element={<Scenarios />} />
              <Route path="/enterprise" element={<Enterprise />} />
              <Route path="/solutions" element={<Solutions />} />
              <Route
                path="/industries"
                element={
                  <PlaceholderPage
                    title="Industries"
                    description="Aviation & Aerospace is Operion's first commercial focus. Industry-specific experiences are being prepared for a later phase."
                  />
                }
              />
              <Route
                path="/product"
                element={<Navigate to="/platform" replace />}
              />
              <Route path="/aviation" element={<Navigate to="/industries/aviation" replace />} />
              <Route
                path="/how-it-works"
                element={
                  <PlaceholderPage
                    title="How it works"
                    description="A walkthrough of the upload → analysis → intelligence pipeline is coming here."
                  />
                }
              />
              <Route path="/about" element={<About />} />
              <Route path="/login" element={<Login />} />
            </Route>

            <Route element={<DemoLayout />}>
              <Route
                path="/demo"
                element={<DemoHub />}
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
