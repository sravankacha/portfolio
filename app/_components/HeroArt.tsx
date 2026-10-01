import GlassBlob from "./GlassBlob";
import ShipHelm from "./ocean/ShipHelm";

/** Per-theme hero art. CSS shows only the active theme's slot. */
export default function HeroArt({ className = "" }: { className?: string }) {
  return (
    <div className={`hero-art ${className}`}>
      <div className="hero-art__editorial" aria-hidden="true">
        <div className="hero-art__editorial-halo" />
        <div className="hero-art__editorial-shape" />
        <GlassBlob />
      </div>
      <div className="hero-art__ocean">
        <ShipHelm />
      </div>
      <div className="hero-art__diner" aria-hidden="true">
        <div>
          <div className="diner-sign">sk.</div>
          <div className="diner-sign__sub">open all night</div>
        </div>
      </div>
    </div>
  );
}
