import React from "react";

const CLASS_BY_KIND = {
  enter: "op-motion-enter",
  exit: "op-motion-exit",
  focus: "op-motion-focus",
  expand: "op-motion-expand",
  collapse: "op-motion-collapse",
  navigate: "op-motion-navigate",
  layer: "op-motion-layer",
  inspector: "op-motion-inspector",
};

export default function SpatialTransition({ kind = "enter", children, className = "", style }) {
  const motionClass = CLASS_BY_KIND[kind] || CLASS_BY_KIND.enter;
  return (
    <div className={`${motionClass} ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}
