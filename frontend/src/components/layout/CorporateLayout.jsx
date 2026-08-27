import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import BrandMark from "../ui/BrandMark";
import Button from "../ui/Button";
import { Container } from "../ui/Layout";

const NAV_LINKS = [
  { to: "/platform", label: "Platform" },
  { to: "/solutions", label: "Solutions" },
  { to: "/industries/aviation", label: "Industries" },
  { to: "/scenarios", label: "Scenarios" },
  { to: "/enterprise", label: "Enterprise" },
  { to: "/about", label: "About" },
];

export default function CorporateLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = React.useRef(null);
  const menuRef = React.useRef(null);
  const location = useLocation();
  const isHome = location.pathname === "/";

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
      if (event.key === "Tab") {
        const focusable = menuRef.current?.querySelectorAll("a, button");
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
    menuRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = "";
      menuButtonRef.current?.focus();
    };
  }, [menuOpen]);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  return (
    <div className={`op-shell op-corporate-shell${isHome ? " op-home-shell" : ""}${scrolled ? " op-shell-scrolled" : ""}`} data-op-theme="light">
      <header className="op-shell-header op-corporate-header">
        <Container>
          <div className="op-topbar">
            <BrandMark to="/" size="md" className="op-corporate-logo" />

            <nav className="op-nav op-corporate-nav" aria-label="Corporate navigation">
              {isHome && <Link to="/" className="op-nav-link op-home-nav-home">Home</Link>}
              {NAV_LINKS.map((link) => (
                <Link key={link.to} to={link.to} className="op-nav-link">
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="op-row op-corporate-actions" style={{ justifyContent: "flex-end", gap: "var(--op-space-2)" }}>
              <Button to="/login" variant="secondary">
                Sign in
              </Button>
              <Button to="/demo" variant="primary">
                Request a Demo
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
              <span aria-hidden="true" className="op-menu-word">{menuOpen ? "CLOSE" : "MENU"}</span><span aria-hidden="true" className="op-menu-icon">{menuOpen ? "×" : "☰"}</span>
            </button>
          </div>
        </Container>

        <div id="corporate-navigation-overlay" ref={menuRef} tabIndex={-1} className={`op-navigation-overlay${menuOpen ? " op-navigation-overlay-open" : ""}`} aria-hidden={!menuOpen} inert={!menuOpen}>
          <div className="op-navigation-overlay-inner">
            <nav aria-label="Expanded corporate navigation">
              <Link to="/" className={location.pathname === "/" ? "op-navigation-active" : ""} onClick={() => setMenuOpen(false)}>Home</Link>
              {NAV_LINKS.map((link) => <Link key={link.to} to={link.to} className={location.pathname === link.to ? "op-navigation-active" : ""} onClick={() => setMenuOpen(false)}>{link.label}</Link>)}
            </nav>
            <div className="op-navigation-overlay-actions"><Button to="/login" variant="secondary">Sign in</Button><Button to="/demo" variant="primary">Request a Demo <span aria-hidden="true">↗</span></Button></div>
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
  return <footer className="op-corporate-footer"><Container><div className="op-corporate-footer-lead"><div><p className="op-corporate-footer-label">OPERION OS / AVIATION INTELLIGENCE</p><h2>Intelligence for the complexity of aviation.</h2><p>Connect the relationships that matter across contracts, obligations, operations and decisions.</p></div><div className="op-corporate-footer-cta"><Button to="/industries/aviation" variant="primary">Explore Aviation Intelligence <span aria-hidden="true">↗</span></Button><Button to="/demo" variant="secondary">Talk to us</Button></div></div><div className="op-corporate-footer-grid"><div><strong className="op-corporate-footer-wordmark">OPERION OS</strong><p>Contract intelligence for the aviation ecosystem.</p></div><div><h3>Explore</h3><Link to="/platform">Platform</Link><Link to="/solutions">Solutions</Link><Link to="/industries/aviation">Aviation</Link></div><div><h3>Company</h3><Link to="/about">About Us</Link><Link to="/enterprise">Enterprise</Link><Link to="/demo">Contact</Link></div><div><h3>Account</h3><Link to="/login">Sign in</Link><Link to="/demo">Request access</Link></div></div><div className="op-corporate-footer-utility"><span>© {new Date().getFullYear()} Operion OS. Aviation contract intelligence.</span><span>Privacy and legal information available through Operion.</span></div></Container></footer>;
}
