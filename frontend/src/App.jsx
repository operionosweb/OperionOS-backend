import React, { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { OrganizationProvider } from "./context/OrganizationContext";
import CorporateLayout from "./components/layout/CorporateLayout";
import RequireAuth from "./components/auth/RequireAuth";
import RouteMetadata from "./components/seo/RouteMetadata";
import Analytics from "./components/analytics/Analytics";
import { LoadingState } from "./components/ui/States";

const ProductionLayout = lazy(() => import("./components/layout/ProductionLayout"));
const DemoShell = lazy(() => import("./components/layout/DemoShell"));
const CorporateHome = lazy(() => import("./routes/CorporateHome"));
const AnalysisView = lazy(() => import("./routes/AnalysisView"));
const Login = lazy(() => import("./routes/Login"));
const PlaceholderPage = lazy(() => import("./routes/PlaceholderPage"));
const Product = lazy(() => import("./routes/Product"));
const AviationCommercial = lazy(() => import("./routes/AviationCommercial"));
const HowItWorks = lazy(() => import("./routes/HowItWorks"));
const Security = lazy(() => import("./routes/Security"));
const RequestDemo = lazy(() => import("./routes/RequestDemo"));
const PrivacyPage = lazy(() => import("./routes/LegalPages").then((module) => ({ default: module.PrivacyPage })));
const LegalPage = lazy(() => import("./routes/LegalPages").then((module) => ({ default: module.LegalPage })));
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
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      window.requestAnimationFrame(() => document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" }));
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

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
              <Route path="/product" element={<Product />} />
              <Route path="/platform" element={<Navigate to="/product" replace />} />
              <Route path="/aviation" element={<AviationCommercial />} />
              <Route path="/industries/aviation" element={<Navigate to="/aviation" replace />} />
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
              <Route path="/how-it-works" element={<HowItWorks />} />
              <Route path="/security" element={<Security />} />
              <Route path="/request-demo" element={<RequestDemo />} />
              <Route path="/contact" element={<Navigate to="/request-demo" replace />} />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/legal" element={<LegalPage />} />
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
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<ProductionDashboard />} />
              <Route path="contracts" element={<ProductionContracts />} />
              <Route path="contracts/:id" element={<ContractWorkspace />} />
              <Route path="contracts/:id/analysis" element={<AnalysisView />} />
              <Route path="upload" element={<ProductionUpload />} />
              <Route path="aviation" element={<ProductionIntelligence />} />
              <Route path="intelligence" element={<Navigate to="../aviation" replace />} />
              <Route path="live-tracking" element={<ProductionLiveTracking />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
          <RouteMetadata />
          <Analytics />
        </BrowserRouter>
      </OrganizationProvider>
    </AuthProvider>
  );
}
