"use client";

import { useEffect, useRef, type ReactNode, Fragment } from "react";
import { createPortal } from "react-dom";

interface PortalProps {
  children: ReactNode;
  container?: HTMLElement | null;
}

export function Portal({ children, container }: PortalProps) {
  const mountRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (container) {
      mountRef.current = container;
    } else {
      mountRef.current = document.createElement("div");
      document.body.appendChild(mountRef.current);
    }

    return () => {
      if (mountRef.current && !container) {
        document.body.removeChild(mountRef.current);
      }
    };
  }, [container]);

  if (!mountRef.current) return null;

  return createPortal(<Fragment>{children}</Fragment>, mountRef.current);
}