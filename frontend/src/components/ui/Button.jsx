import React from "react";
import { Link } from "react-router-dom";

const VARIANT_CLASS = {
  primary: "op-btn op-btn-primary",
  secondary: "op-btn op-btn-secondary",
  quiet: "op-btn op-btn-quiet",
};

export default function Button({ to, href, variant = "primary", children, onClick, type = "button", ariaLabel, disabled = false }) {
  const className = VARIANT_CLASS[variant] || VARIANT_CLASS.primary;

  if (to) {
    return (
      <Link to={to} className={className} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }

  if (href) {
    return (
      <a href={href} className={className} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }

  return (
    <button type={type} className={className} onClick={onClick} aria-label={ariaLabel} disabled={disabled}>
      {children}
    </button>
  );
}
