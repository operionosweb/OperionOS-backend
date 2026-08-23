import { useEffect, useRef, useState } from "react";

/**
 * Minimal scroll-reveal utility: returns a ref and a boolean that flips
 * true once the element enters the viewport. Used sparingly for entrance
 * transitions — no animation library required.
 */
export function useReveal(options = { threshold: 0.2 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, options);

    observer.observe(node);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [ref, visible];
}
