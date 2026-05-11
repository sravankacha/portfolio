"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Lazy-load OceanCanvas so Three.js (~150KB) only ships when the user is on the ocean theme.
const OceanCanvas = dynamic(() => import("./OceanCanvas"), { ssr: false });

export default function OceanCanvasGate() {
  const [isOcean, setIsOcean] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsOcean(document.documentElement.dataset.theme === "ocean");
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  if (!isOcean) return null;
  return <OceanCanvas />;
}
