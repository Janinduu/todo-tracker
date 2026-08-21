"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fades and lifts its children into place as they scroll into view.
 *
 * Wraps server-rendered children, so the content itself stays a server
 * component — only the observer runs on the client. Fires once per element:
 * re-animating on every scroll past is distracting in a tool you sit in.
 *
 * Reduced-motion is handled entirely in globals.css, which pins `.reveal` to
 * fully visible under that media query — no JS branch needed here.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Never leave content stranded at opacity 0 on a browser without the API.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -40px 0px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? "reveal-in" : ""} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
