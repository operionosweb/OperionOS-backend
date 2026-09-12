import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import BrandMark from "../ui/BrandMark";
import Button from "../ui/Button";
import { Container } from "../ui/Layout";
import { openAnalyticsPreferences, trackEvent } from "../analytics/Analytics";

const NAV_LINKS = [
  { to: "/product", label: "Platform" },
  { to: "/#intelligence", label: "Intelligence" },
  { to: "/aviation", label: "Aviation" },
  { to: "/scenarios", label: "Scenarios" },
  { to: "/about", label: "Resources" },
];

export default function CorporateLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const menuButtonRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const hero = document.querySelector(".op-cinematic-hero");
    if (!hero) {
      setHeroVisible(false);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      setHeroVisible(entry.isIntersecting && entry.boundingClientRect.top <= 80);
    }, { rootMargin: "-80px 0px 0px 0px", threshold: [0, 0.01] });
    observer.observe(hero);
    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    menuRef.current?.toggleAttribute("inert", !menuOpen);
    if (!menuOpen) return undefined;
    const focusable = menuRef.current?.querySelectorAll("a, button");
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key === "Tab") {
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    document.body.style.overflow = "hidden";
    focusable?.[0]?.focus();
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className={`op-shell op-corporate-shell${isHome ? " op-home-shell" : ""}${heroVisible ? " op-hero-active" : " op-content-active"}${menuOpen ? " op-menu-active" : ""}`} data-op-theme="light">
      <header className="op-shell-header op-corporate-header">
        <Container>
          <div className="op-topbar">
            <BrandMark to="/" size="md" className="op-corporate-logo" />

            <nav className="op-nav op-corporate-nav" aria-label="Corporate navigation">
              {NAV_LINKS.map((link) => (
                <Link key={link.to} to={link.to} className="op-nav-link" onClick={() => link.event && trackEvent(link.event, { location: "navigation" })}>
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="op-row op-corporate-actions" style={{ justifyContent: "flex-end", gap: "var(--op-space-2)" }}>
              <Link to="/login" className="op-nav-link" onClick={() => trackEvent("login_click", { location: "navigation" })}>Login</Link>
              <Link to="/demo" className="op-nav-link" onClick={() => trackEvent("demo_access_click", { location: "navigation" })}>Access Demo</Link>
              <Button to="/request-demo" variant="primary" onClick={() => trackEvent("request_demo_click", { location: "navigation" })}>
                Request Demo
              </Button>
            </div>

            <button
              type="button"
              ref={menuButtonRef}
              onClick={() => setMenuOpen((open) => !open)}
              className="op-mobile-menu-toggle"
              aria-expanded={menuOpen}
              aria-controls="corporate-navigation-overlay"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            >
              <span aria-hidden="true" className="op-menu-word">{menuOpen ? "CLOSE" : "MENU"}</span><span aria-hidden="true" className="op-menu-icon">{menuOpen ? <X size={24} /> : <Menu size={24} />}</span>
            </button>
          </div>
        </Container>

        <div id="corporate-navigation-overlay" ref={menuRef} tabIndex={-1} className={`op-navigation-overlay${menuOpen ? " op-navigation-overlay-open" : ""}`} aria-hidden={!menuOpen}>
          <div className="op-navigation-overlay-inner">
            <nav aria-label="Expanded corporate navigation">
              {NAV_LINKS.map((link) => <Link key={link.to} to={link.to} className={location.pathname === link.to ? "op-navigation-active" : ""} onClick={() => { setMenuOpen(false); if (link.event) trackEvent(link.event, { location: "mobile_navigation" }); }}>{link.label}</Link>)}
            </nav>
            <div className="op-navigation-overlay-actions"><Button to="/request-demo" variant="primary" onClick={() => trackEvent("request_demo_click", { location: "mobile_navigation" })}>Request Demo <span aria-hidden="true">↗</span></Button><Button to="/demo" variant="secondary" onClick={() => trackEvent("demo_access_click", { location: "mobile_navigation" })}>Access Demo</Button><Button to="/login" variant="quiet" onClick={() => trackEvent("login_click", { location: "mobile_navigation" })}>Login</Button></div>
            <p className="op-navigation-overlay-meta">OPERION OS / AVIATION CONTRACT INTELLIGENCE</p>
          </div>
        </div>
      </header>

      <main className="op-shell-main">
        <Outlet />
      </main>

      <CorporateFooter />
    </div>
  );
}

function CorporateFooter() {
  return <footer className="op-corporate-footer"><Container><div className="op-corporate-footer-lead"><div><p className="op-corporate-footer-label">OPERION / CONTRACT INTELLIGENCE</p><h2>Intelligence for the complexity of aviation.</h2><p>Connect the relationships that matter across contracts, obligations, operations and decisions.</p></div><div className="op-corporate-footer-cta"><Button to="/aviation" variant="primary">Explore Aviation <span aria-hidden="true">↗</span></Button><Button to="/request-demo" variant="secondary" onClick={() => trackEvent("contact_click", { location: "footer" })}>Talk to Operion</Button></div></div><div className="op-corporate-footer-grid"><div><strong className="op-corporate-footer-wordmark">OPERION</strong><p>Contract Intelligence for Aviation.</p><a href="mailto:info@operionos.com">info@operionos.com</a></div><div><h3>Explore</h3><Link to="/product">Product</Link><Link to="/aviation">Aviation</Link><Link to="/how-it-works">How It Works</Link><Link to="/security">Security</Link></div><div><h3>Company</h3><Link to="/about">About</Link><Link to="/request-demo">Contact</Link><Link to="/privacy">Privacy</Link><Link to="/legal">Legal</Link></div><div><h3>Access</h3><Link to="/login" onClick={() => trackEvent("login_click", { location: "footer" })}>Login</Link><Link to="/demo" onClick={() => trackEvent("demo_access_click", { location: "footer" })}>Access Demo</Link><Link to="/request-demo">Request private access</Link></div></div><div className="op-corporate-footer-utility"><span>© {new Date().getFullYear()} Operion. Aviation contract intelligence.</span><button type="button" className="op-footer-privacy-button" onClick={openAnalyticsPreferences}>Analytics preferences</button></div></Container></footer>;
}
