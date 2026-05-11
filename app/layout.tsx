import type { Metadata } from "next";
import { Fraunces, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "./_components/Header";
import Footer from "./_components/Footer";
import ThemeInitScript from "./_components/ThemeInitScript";
import OceanCanvasGate from "./_components/OceanCanvasGate";
import { profile } from "./_data/profile";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://sravankacha.com";
const TITLE = `${profile.name} — Product, Design, Engineering`;
const DESCRIPTION =
  "Problem solver focused on user problems — using data to understand, validate, and ship solutions with depth. Senior Software Engineer at Meta with experience across product, design, solution architecture, regulatory risk, and privacy.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: `%s — ${profile.name}`,
  },
  description: DESCRIPTION,
  applicationName: profile.name,
  authors: [{ name: profile.name, url: SITE_URL }],
  creator: profile.name,
  publisher: profile.name,
  keywords: [
    "Sravan Kachavarapu",
    "Senior Software Engineer",
    "Meta",
    "Frontend Engineer",
    "Product Development",
    "Solution Architect",
    "Design Systems",
    "Accessibility",
    "WCAG",
    "Privacy",
    "Regulatory Risk",
    "Washington DC",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: profile.name,
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    creator: "@sravankacha",
  },
  category: "technology",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: profile.name,
  jobTitle: profile.tagline,
  url: SITE_URL,
  worksFor: { "@type": "Organization", name: "Meta" },
  address: {
    "@type": "PostalAddress",
    addressLocality: "Washington",
    addressRegion: "DC",
    addressCountry: "US",
  },
  sameAs: [profile.linkedin, profile.github, profile.twitter],
  knowsAbout: profile.skills,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <head>
        <ThemeInitScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground relative">
        <OceanCanvasGate />
        <div className="flex flex-col flex-1 relative z-10">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
