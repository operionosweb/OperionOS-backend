import React, { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { OrganizationProvider } from "./context/OrganizationContext";
import CorporateLayout from "./components/layout/CorporateLayout";
import RequireAuth from "./components/auth/RequireAuth";
import { LoadingState } from "./components/ui/States";

const ProductionLayout = lazy(() => import("./components/layout/ProductionLayout"));
const DemoShell = lazy(() => import("./components/layout/DemoShell"));
const CorporateHome = lazy(() => import("./routes/CorporateHome"));
const AnalysisView = lazy(() => import("./routes/AnalysisView"));
const Login = lazy(() => import("./routes/Login"));
const PlaceholderPage = lazy(() => import("./routes/PlaceholderPage"));
const Platform = lazy(() => import("./routes/Platform"));
const Aviation = lazy(() => import("./routes/Aviation"));
const Scenarios = lazy(() => import("./routes/Scenarios"));
const Enterprise = lazy(() => import("./routes/Enterprise"));
const Solutions = lazy(() => import("./routes/Solutions"));
const About = lazy(() => import("./routes/About"));
const ProductionDashboard = lazy(() => import("./routes/ProductionDashboard"));
const ProductionContracts = lazy(() => import("./routes/ProductionContracts"));
const ProductionUpload = lazy(() => import("./routes/ProductionUpload"));
const ProductionIntelligence = lazy(() => import("./routes/ProductionIntelligence"));
const ContractWorkspace = lazy(() => import("./routes/ContractWorkspace"));
const ProductionLiveTracking = lazy(() => import("./routes/ProductionLiveTracking"));
const DemoDashboard = lazy(() => import("./routes/demo/DemoDashboard"));
const DemoContracts = lazy(() => import("./routes/demo/DemoContracts"));
const DemoUpload = lazy(() => import("./routes/demo/DemoUpload"));
const DemoWorkspace = lazy(() => import("./routes/demo/DemoWorkspace"));
const DemoLiveTracking = lazy(() => import("./routes/demo/AviationIntelligenceMap"));
const DemoIntelligence = lazy(() => import("./routes/demo/DemoIntelligence"));
const DemoAdmin = lazy(() => import("./routes/demo/DemoAdmin"));

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <OrganizationProvider>
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<div style={{ padding: 32 }}><LoadingState label="Preparing Operion…" /></div>}>
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

            <Route
              path="/app"
              element={
                <RequireAuth>
                  <ProductionLayout />
                </RequireAuth>
              }
            >
              <Route index element={<ProductionDashboard />} />
              <Route path="contracts" element={<ProductionContracts />} />
              <Route path="contracts/:id" element={<ContractWorkspace />} />
              <Route path="contracts/:id/analysis" element={<AnalysisView />} />
              <Route path="upload" element={<ProductionUpload />} />
              <Route path="intelligence" element={<ProductionIntelligence />} />
              <Route path="live-tracking" element={<ProductionLiveTracking />} />
            </Route>

            <Route path="/demo" element={<DemoShell />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DemoDashboard />} />
              <Route path="contracts" element={<DemoContracts />} />
              <Route path="contracts/:id" element={<Navigate to="overview" replace />} />
              <Route path="contracts/:id/:section" element={<DemoWorkspace />} />
              <Route path="upload" element={<DemoUpload />} />
              <Route path="live-tracking" element={<DemoLiveTracking />} />
              <Route path="intelligence" element={<DemoIntelligence />} />
              <Route path=":admin" element={<DemoAdmin />} />
            </Route>
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </OrganizationProvider>
    </AuthProvider>
  );
}
