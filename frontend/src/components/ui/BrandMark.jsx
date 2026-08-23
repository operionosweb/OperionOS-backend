import React from "react";
import { Link } from "react-router-dom";
import operionLogo from "../../assets/brand/operion-logo.webp";

const SIZE_MAP = {
  sm: "132px",
  md: "176px",
  lg: "220px",
};

export default function BrandMark({
  size = "md",
  to,
  alt = "Operion",
  className = "",
  style,
  holdingSurface = false,
  loading = "eager",
}) {
  const width = SIZE_MAP[size] || size;
  const frameStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width,
    maxWidth: "100%",
    ...(holdingSurface
      ? {
          background: "var(--op-color-surface)",
          border: "1px solid var(--op-color-border)",
          borderRadius: "var(--op-radius-control)",
          padding: "8px 10px",
        }
      : {}),
    ...style,
  };

  const image = (
    <span className={className} style={frameStyle}>
      <img
        src={operionLogo}
        alt={alt}
        loading={loading}
        style={{ display: "block", width: "100%", height: "auto", objectFit: "contain" }}
      />
    </span>
  );

  if (!to) return image;
  return (
    <Link to={to} aria-label="Operion home" style={{ display: "inline-flex" }}>
      {image}
    </Link>
  );
}
