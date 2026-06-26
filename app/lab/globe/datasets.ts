/**
 * Data sources for the globe lab experiment. Every dataset normalizes into a
 * uniform `Point[]` shape so the canvas renderer doesn't care where the data
 * came from.
 */

export type GlobePoint = {
  lat: number;
  lon: number;
  /** Normalized magnitude in [0, 1] — drives spike height + color ramp. */
  value: number;
  /** Tooltip label. */
  label: string;
  /** Optional secondary line in the tooltip. */
  sublabel?: string;
  /** Original/raw numeric for the legend (e.g. 6.8 for a M6.8 quake). */
  raw?: number;
};

export type DatasetId =
  | "earthquakes"
  | "iss"
  | "volcanoes"
  | "population";

export type DatasetMeta = {
  id: DatasetId;
  label: string;
  source: string;
  unit: string;
  /** Hex color for spikes / point markers in this dataset. */
  color: string;
  /** Multiplier for spike length relative to globe radius (default 0.35). */
  spikeScale?: number;
  /** Whether the dataset auto-refreshes (e.g. ISS every 5s). */
  livePollMs?: number;
};

export const DATASETS: Record<DatasetId, DatasetMeta> = {
  earthquakes: {
    id: "earthquakes",
    label: "Earthquakes (M4.5+, 30d)",
    source: "USGS",
    unit: "magnitude",
    color: "#ff3d57",
    spikeScale: 0.4,
  },
  volcanoes: {
    id: "volcanoes",
    label: "Active volcanoes",
    source: "Smithsonian GVP",
    unit: "elevation (m)",
    color: "#ffb627",
    spikeScale: 0.25,
  },
  iss: {
    id: "iss",
    label: "ISS live position",
    source: "wheretheiss.at",
    unit: "altitude (km)",
    color: "#64dfdf",
    spikeScale: 0.5,
    livePollMs: 5000,
  },
  population: {
    id: "population",
    label: "Population (2023)",
    source: "World Bank",
    unit: "people",
    color: "#80ff80",
    spikeScale: 0.55,
  },
};

// ---------- Earthquakes (USGS) ----------

type USGSFeature = {
  properties: { mag: number | null; place: string | null; time: number };
  geometry: { coordinates: [number, number, number] };
};

export async function fetchEarthquakes(): Promise<GlobePoint[]> {
  const r = await fetch(
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson",
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error("USGS fetch failed");
  const json = (await r.json()) as { features: USGSFeature[] };

  // Map magnitudes 4.5 → 0 and 8 → 1 (clamped) for the spike-height ramp.
  const norm = (m: number) => Math.max(0, Math.min(1, (m - 4.5) / 3.5));

  return json.features
    .filter((f) => f.properties.mag != null)
    .map((f) => {
      const [lon, lat, depth] = f.geometry.coordinates;
      const mag = f.properties.mag as number;
      return {
        lat,
        lon,
        value: norm(mag),
        raw: mag,
        label: `M${mag.toFixed(1)} · ${f.properties.place ?? "unknown"}`,
        sublabel: `depth ${depth.toFixed(0)} km · ${new Date(f.properties.time).toISOString().slice(0, 10)}`,
      };
    });
}

// ---------- ISS (wheretheiss.at) ----------

export async function fetchISS(): Promise<GlobePoint[]> {
  const r = await fetch("https://api.wheretheiss.at/v1/satellites/25544", {
    cache: "no-store",
  });
  if (!r.ok) throw new Error("ISS fetch failed");
  const j = (await r.json()) as {
    latitude: number;
    longitude: number;
    altitude: number;
    velocity: number;
  };
  return [
    {
      lat: j.latitude,
      lon: j.longitude,
      value: 1,
      raw: j.altitude,
      label: `ISS @ ${j.altitude.toFixed(0)} km`,
      sublabel: `${j.velocity.toFixed(0)} km/h`,
    },
  ];
}

// ---------- Volcanoes (curated holocene-active list, Smithsonian GVP) ----------

// Static snapshot — ~60 prominent currently/recently active volcanoes.
// Source: Smithsonian Global Volcanism Program (public domain). Snapshot
// embedded so the page works offline and avoids cross-origin issues with the
// Smithsonian feed.
const VOLCANOES: { name: string; lat: number; lon: number; elev: number; country: string }[] = [
  { name: "Mauna Loa", lat: 19.475, lon: -155.608, elev: 4170, country: "USA" },
  { name: "Kīlauea", lat: 19.421, lon: -155.287, elev: 1222, country: "USA" },
  { name: "Mount St. Helens", lat: 46.2, lon: -122.18, elev: 2549, country: "USA" },
  { name: "Mount Rainier", lat: 46.853, lon: -121.76, elev: 4392, country: "USA" },
  { name: "Mount Hood", lat: 45.374, lon: -121.695, elev: 3426, country: "USA" },
  { name: "Mount Shasta", lat: 41.409, lon: -122.193, elev: 4317, country: "USA" },
  { name: "Redoubt", lat: 60.485, lon: -152.742, elev: 3108, country: "USA" },
  { name: "Augustine", lat: 59.363, lon: -153.43, elev: 1252, country: "USA" },
  { name: "Cleveland", lat: 52.825, lon: -169.944, elev: 1730, country: "USA" },
  { name: "Popocatépetl", lat: 19.023, lon: -98.622, elev: 5426, country: "Mexico" },
  { name: "Colima", lat: 19.514, lon: -103.62, elev: 3850, country: "Mexico" },
  { name: "Fuego", lat: 14.473, lon: -90.88, elev: 3763, country: "Guatemala" },
  { name: "Pacaya", lat: 14.382, lon: -90.601, elev: 2569, country: "Guatemala" },
  { name: "Santa María", lat: 14.756, lon: -91.552, elev: 3772, country: "Guatemala" },
  { name: "San Cristóbal", lat: 12.702, lon: -87.004, elev: 1745, country: "Nicaragua" },
  { name: "Masaya", lat: 11.984, lon: -86.161, elev: 635, country: "Nicaragua" },
  { name: "Arenal", lat: 10.463, lon: -84.703, elev: 1670, country: "Costa Rica" },
  { name: "Poás", lat: 10.2, lon: -84.233, elev: 2708, country: "Costa Rica" },
  { name: "Soufrière Hills", lat: 16.72, lon: -62.18, elev: 915, country: "Montserrat" },
  { name: "Soufrière (St. Vincent)", lat: 13.33, lon: -61.18, elev: 1234, country: "St. Vincent" },
  { name: "Nevado del Ruiz", lat: 4.892, lon: -75.324, elev: 5321, country: "Colombia" },
  { name: "Galeras", lat: 1.22, lon: -77.37, elev: 4276, country: "Colombia" },
  { name: "Cotopaxi", lat: -0.677, lon: -78.436, elev: 5911, country: "Ecuador" },
  { name: "Tungurahua", lat: -1.467, lon: -78.442, elev: 5023, country: "Ecuador" },
  { name: "Sangay", lat: -2.005, lon: -78.341, elev: 5286, country: "Ecuador" },
  { name: "Ubinas", lat: -16.355, lon: -70.903, elev: 5672, country: "Peru" },
  { name: "Villarrica", lat: -39.42, lon: -71.93, elev: 2847, country: "Chile" },
  { name: "Lascar", lat: -23.37, lon: -67.73, elev: 5592, country: "Chile" },
  { name: "Calbuco", lat: -41.326, lon: -72.614, elev: 2003, country: "Chile" },
  { name: "Erebus", lat: -77.53, lon: 167.17, elev: 3794, country: "Antarctica" },
  { name: "Hekla", lat: 63.98, lon: -19.7, elev: 1490, country: "Iceland" },
  { name: "Katla", lat: 63.633, lon: -19.083, elev: 1512, country: "Iceland" },
  { name: "Eyjafjallajökull", lat: 63.63, lon: -19.62, elev: 1666, country: "Iceland" },
  { name: "Fagradalsfjall", lat: 63.9, lon: -22.27, elev: 385, country: "Iceland" },
  { name: "Grímsvötn", lat: 64.42, lon: -17.33, elev: 1725, country: "Iceland" },
  { name: "Etna", lat: 37.748, lon: 14.999, elev: 3357, country: "Italy" },
  { name: "Stromboli", lat: 38.789, lon: 15.213, elev: 924, country: "Italy" },
  { name: "Vesuvius", lat: 40.821, lon: 14.426, elev: 1281, country: "Italy" },
  { name: "Santorini", lat: 36.404, lon: 25.396, elev: 367, country: "Greece" },
  { name: "Nyiragongo", lat: -1.52, lon: 29.25, elev: 3470, country: "DRC" },
  { name: "Ol Doinyo Lengai", lat: -2.764, lon: 35.914, elev: 2962, country: "Tanzania" },
  { name: "Erta Ale", lat: 13.6, lon: 40.67, elev: 613, country: "Ethiopia" },
  { name: "Piton de la Fournaise", lat: -21.244, lon: 55.708, elev: 2632, country: "Réunion" },
  { name: "Karthala", lat: -11.75, lon: 43.38, elev: 2361, country: "Comoros" },
  { name: "Klyuchevskoy", lat: 56.057, lon: 160.638, elev: 4754, country: "Russia" },
  { name: "Sheveluch", lat: 56.653, lon: 161.36, elev: 3283, country: "Russia" },
  { name: "Bezymianny", lat: 55.972, lon: 160.595, elev: 2882, country: "Russia" },
  { name: "Karymsky", lat: 54.05, lon: 159.45, elev: 1536, country: "Russia" },
  { name: "Sakurajima", lat: 31.585, lon: 130.657, elev: 1117, country: "Japan" },
  { name: "Fuji", lat: 35.358, lon: 138.731, elev: 3776, country: "Japan" },
  { name: "Aso", lat: 32.884, lon: 131.104, elev: 1592, country: "Japan" },
  { name: "Unzen", lat: 32.761, lon: 130.299, elev: 1500, country: "Japan" },
  { name: "Taal", lat: 14.002, lon: 120.993, elev: 311, country: "Philippines" },
  { name: "Mayon", lat: 13.257, lon: 123.685, elev: 2462, country: "Philippines" },
  { name: "Pinatubo", lat: 15.13, lon: 120.35, elev: 1486, country: "Philippines" },
  { name: "Krakatau", lat: -6.102, lon: 105.423, elev: 813, country: "Indonesia" },
  { name: "Merapi", lat: -7.54, lon: 110.446, elev: 2910, country: "Indonesia" },
  { name: "Bromo", lat: -7.942, lon: 112.95, elev: 2329, country: "Indonesia" },
  { name: "Semeru", lat: -8.108, lon: 112.92, elev: 3676, country: "Indonesia" },
  { name: "Sinabung", lat: 3.17, lon: 98.392, elev: 2460, country: "Indonesia" },
  { name: "Agung", lat: -8.343, lon: 115.508, elev: 2997, country: "Indonesia" },
  { name: "Tambora", lat: -8.25, lon: 118, elev: 2850, country: "Indonesia" },
  { name: "Rinjani", lat: -8.42, lon: 116.47, elev: 3726, country: "Indonesia" },
  { name: "White Island (Whakaari)", lat: -37.52, lon: 177.18, elev: 321, country: "New Zealand" },
  { name: "Ruapehu", lat: -39.281, lon: 175.564, elev: 2797, country: "New Zealand" },
  { name: "Yasur", lat: -19.53, lon: 169.447, elev: 361, country: "Vanuatu" },
  { name: "Manam", lat: -4.08, lon: 145.037, elev: 1807, country: "Papua New Guinea" },
  { name: "Ulawun", lat: -5.05, lon: 151.33, elev: 2334, country: "Papua New Guinea" },
  { name: "Hunga Tonga", lat: -20.55, lon: -175.39, elev: 114, country: "Tonga" },
];

export async function fetchVolcanoes(): Promise<GlobePoint[]> {
  // Local static dataset — async signature kept for consistency.
  // Elevation 0-6000m mapped to value 0-1 for the spike-height ramp.
  return VOLCANOES.map((v) => ({
    lat: v.lat,
    lon: v.lon,
    value: Math.max(0.15, Math.min(1, v.elev / 6000)),
    raw: v.elev,
    label: `${v.name}`,
    sublabel: `${v.country} · ${v.elev.toLocaleString()} m`,
  }));
}

// ---------- Population (World Bank, joined with country centroids) ----------

// UN M49 numeric country code → ISO 3166-1 alpha-3. The Natural Earth topojson
// used by GlobeCanvas tags features by M49; the World Bank API speaks ISO3.
// Source: ISO 3166 official list.
const M49_TO_ISO3: Record<number, string> = {
  4:"AFG", 8:"ALB", 10:"ATA", 12:"DZA", 16:"ASM", 20:"AND", 24:"AGO", 28:"ATG", 31:"AZE", 32:"ARG",
  36:"AUS", 40:"AUT", 44:"BHS", 48:"BHR", 50:"BGD", 51:"ARM", 52:"BRB", 56:"BEL", 60:"BMU", 64:"BTN",
  68:"BOL", 70:"BIH", 72:"BWA", 74:"BVT", 76:"BRA", 84:"BLZ", 86:"IOT", 90:"SLB", 92:"VGB", 96:"BRN",
  100:"BGR", 104:"MMR", 108:"BDI", 112:"BLR", 116:"KHM", 120:"CMR", 124:"CAN", 132:"CPV", 136:"CYM",
  140:"CAF", 144:"LKA", 148:"TCD", 152:"CHL", 156:"CHN", 158:"TWN", 162:"CXR", 166:"CCK", 170:"COL",
  174:"COM", 175:"MYT", 178:"COG", 180:"COD", 184:"COK", 188:"CRI", 191:"HRV", 192:"CUB", 196:"CYP",
  203:"CZE", 204:"BEN", 208:"DNK", 212:"DMA", 214:"DOM", 218:"ECU", 222:"SLV", 226:"GNQ", 231:"ETH",
  232:"ERI", 233:"EST", 234:"FRO", 238:"FLK", 239:"SGS", 242:"FJI", 246:"FIN", 248:"ALA", 250:"FRA",
  254:"GUF", 258:"PYF", 260:"ATF", 262:"DJI", 266:"GAB", 268:"GEO", 270:"GMB", 275:"PSE", 276:"DEU",
  288:"GHA", 292:"GIB", 296:"KIR", 300:"GRC", 304:"GRL", 308:"GRD", 312:"GLP", 316:"GUM", 320:"GTM",
  324:"GIN", 328:"GUY", 332:"HTI", 334:"HMD", 336:"VAT", 340:"HND", 344:"HKG", 348:"HUN", 352:"ISL",
  356:"IND", 360:"IDN", 364:"IRN", 368:"IRQ", 372:"IRL", 376:"ISR", 380:"ITA", 384:"CIV", 388:"JAM",
  392:"JPN", 398:"KAZ", 400:"JOR", 404:"KEN", 408:"PRK", 410:"KOR", 414:"KWT", 417:"KGZ", 418:"LAO",
  422:"LBN", 426:"LSO", 428:"LVA", 430:"LBR", 434:"LBY", 438:"LIE", 440:"LTU", 442:"LUX", 446:"MAC",
  450:"MDG", 454:"MWI", 458:"MYS", 462:"MDV", 466:"MLI", 470:"MLT", 474:"MTQ", 478:"MRT", 480:"MUS",
  484:"MEX", 492:"MCO", 496:"MNG", 498:"MDA", 499:"MNE", 500:"MSR", 504:"MAR", 508:"MOZ", 512:"OMN",
  516:"NAM", 520:"NRU", 524:"NPL", 528:"NLD", 531:"CUW", 533:"ABW", 534:"SXM", 535:"BES", 540:"NCL",
  548:"VUT", 554:"NZL", 558:"NIC", 562:"NER", 566:"NGA", 570:"NIU", 574:"NFK", 578:"NOR", 580:"MNP",
  581:"UMI", 583:"FSM", 584:"MHL", 585:"PLW", 586:"PAK", 591:"PAN", 598:"PNG", 600:"PRY", 604:"PER",
  608:"PHL", 612:"PCN", 616:"POL", 620:"PRT", 624:"GNB", 626:"TLS", 630:"PRI", 634:"QAT", 638:"REU",
  642:"ROU", 643:"RUS", 646:"RWA", 652:"BLM", 654:"SHN", 659:"KNA", 660:"AIA", 662:"LCA", 663:"MAF",
  666:"SPM", 670:"VCT", 674:"SMR", 678:"STP", 682:"SAU", 686:"SEN", 688:"SRB", 690:"SYC", 694:"SLE",
  702:"SGP", 703:"SVK", 704:"VNM", 705:"SVN", 706:"SOM", 710:"ZAF", 716:"ZWE", 724:"ESP", 728:"SSD",
  729:"SDN", 732:"ESH", 740:"SUR", 744:"SJM", 748:"SWZ", 752:"SWE", 756:"CHE", 760:"SYR", 762:"TJK",
  764:"THA", 768:"TGO", 772:"TKL", 776:"TON", 780:"TTO", 784:"ARE", 788:"TUN", 792:"TUR", 795:"TKM",
  796:"TCA", 798:"TUV", 800:"UGA", 804:"UKR", 807:"MKD", 818:"EGY", 826:"GBR", 831:"GGY", 832:"JEY",
  833:"IMN", 834:"TZA", 840:"USA", 850:"VIR", 854:"BFA", 858:"URY", 860:"UZB", 862:"VEN", 876:"WLF",
  882:"WSM", 887:"YEM", 894:"ZMB",
};

export function m49ToIso3(m49: number | string): string | undefined {
  const n = typeof m49 === "string" ? parseInt(m49, 10) : m49;
  return M49_TO_ISO3[n];
}

export type CountryCentroid = { iso3: string; name: string; lat: number; lon: number };

export async function fetchPopulation(
  centroids: CountryCentroid[],
): Promise<GlobePoint[]> {
  const r = await fetch(
    "https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json&date=2023&per_page=400",
    { cache: "no-store" },
  );
  if (!r.ok) throw new Error("World Bank fetch failed");
  const j = (await r.json()) as [unknown, Array<{ countryiso3code: string; value: number | null }>];
  const byIso3 = new Map<string, number>();
  for (const row of j[1] ?? []) {
    if (row.value != null && row.countryiso3code) byIso3.set(row.countryiso3code, row.value);
  }

  // log10(population) ramped so China/India don't drown out everything else.
  // Range ~3 (10^3 = 1k) to ~10 (10^10 = 10B).
  const logMin = 5;
  const logMax = 10;
  const norm = (p: number) =>
    Math.max(0, Math.min(1, (Math.log10(p) - logMin) / (logMax - logMin)));

  const points: GlobePoint[] = [];
  for (const c of centroids) {
    const pop = byIso3.get(c.iso3);
    if (pop == null || pop <= 0) continue;
    points.push({
      lat: c.lat,
      lon: c.lon,
      value: norm(pop),
      raw: pop,
      label: c.name,
      sublabel: formatPopulation(pop),
    });
  }
  return points;
}

function formatPopulation(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B people`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M people`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K people`;
  return `${n} people`;
}
