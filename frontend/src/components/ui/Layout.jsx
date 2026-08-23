import React from "react";

export function Container({ className = "", children, style }) {
  return (
    <div className={`op-container ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

export function Section({ className = "", children, id }) {
  return (
    <section id={id} className={`op-section ${className}`.trim()}>
      <Container>{children}</Container>
    </section>
  );
}
