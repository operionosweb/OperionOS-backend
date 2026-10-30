import React from "react";
import { ArrowRight } from "lucide-react";
import { Container } from "../ui/Layout";
import Button from "../ui/Button";
import Reveal from "../ui/Reveal";
import { trackEvent } from "../analytics/Analytics";
import AeroHero from "./AeroHero";

export function SalesHero({ eyebrow, title, copy, children }) {
  return <AeroHero eyebrow={eyebrow} title={title} copy={copy}>{children}</AeroHero>;
}

export function SalesSection({ eyebrow, title, copy, children, dark = false, className = "" }) {
  return (
    <section className={`op-sales-section${dark ? " op-sales-section-dark" : ""} ${className}`.trim()}>
      <Container>
        <Reveal>
          <p className="op-sales-label">{eyebrow}</p>
          <h2>{title}</h2>
          {copy && <p className="op-sales-copy">{copy}</p>}
        </Reveal>
        {children}
      </Container>
    </section>
  );
}

export function SalesFlow({ items, dark = false }) {
  return <Reveal className={`op-sales-flow${dark ? " is-dark" : ""}`}>{items.map((item, index) => <article key={item.title || item}><span>{String(index + 1).padStart(2, "0")}</span><h3>{item.title || item}</h3>{item.copy && <p>{item.copy}</p>}</article>)}</Reveal>;
}

export function SalesCta({ title, copy }) {
  return <section className="op-sales-cta"><Container><Reveal><h2>{title}</h2>{copy && <p>{copy}</p>}<Button to="/request-demo" onClick={() => trackEvent("request_demo_click", { location: "page_final_cta" })}>Request a Private Demo <ArrowRight size={16} /></Button></Reveal></Container></section>;
}
