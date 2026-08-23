import React from "react";
import BrandMark from "./BrandMark";

export default function Logo({ size = "md" }) {
  const variant = size === "lg" ? "lg" : size === "sm" ? "sm" : "md";
  return <BrandMark to="/" size={variant} holdingSurface />;
}
