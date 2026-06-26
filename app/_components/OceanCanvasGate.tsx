"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Lazy-load FFTOceanCanvas — Three.js comes from CDN at runtime so the bundle stays slim.
const OceanCanvas = dynamic(() => import("./FFTOceanCanvas"), { ssr: false });

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
  return (
    <div className="ocean-canvas" aria-hidden="true">
      <OceanCanvas transparent={false} />
    </div>

  );
}
