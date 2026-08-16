"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// Lazy-load the shapeshifter — Three.js comes from CDN at runtime so the bundle stays slim.
const OrigamiHeroCanvas = dynamic(() => import("./OrigamiHeroCanvas"), {
  ssr: false,
});

export default function OrigamiHeroGate() {
  const [isOrigami, setIsOrigami] = useState(false);

  useEffect(() => {
    const update = () => {
      setIsOrigami(document.documentElement.dataset.theme === "origami");
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  if (!isOrigami) return null;
  return (
    <div className="origami-canvas" aria-hidden="true">
      <OrigamiHeroCanvas />
    </div>
  );
}
