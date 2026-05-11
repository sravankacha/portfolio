export type Project = {
  slug: string;
  title: string;
  context: string;
  description: string;
  href?: string;
  archived?: boolean;
};

export const projects: Project[] = [
  {
    slug: "meta-risk-compliance-tools",
    title: "Risk & Compliance Tools & Automation",
    context: "Meta · Current",
    description:
      "Tools and automation for risk and compliance teams — turning regulatory and policy requirements into reliable, repeatable software at Meta's scale.",
  },
  {
    slug: "fanfueled-engage-diy",
    title: "FanFueled Engage DIY",
    context: "FanFueled · 2013",
    description:
      "DIY wizard for brand-page creation on the FanFueled Engage platform.",
    href: "/archive/fanfueled-engage-diy",
    archived: true,
  },
  {
    slug: "platinum-nights",
    title: "Platinum Nights",
    context: "FanFueled · 2013",
    description:
      "Fan engagement scavenger-hunt experience for the launch of Bud Light Blue and Michelob Ultra.",
    href: "/archive/platinumnights",
    archived: true,
  },
  {
    slug: "fanfueled-tickets",
    title: "FanFueled Tickets",
    context: "FanFueled · 2014",
    description:
      "Ticketing UI and embeddable purchase widget for artists, brands, and venues.",
    href: "/archive/fanfueled-tickets",
    archived: true,
  },
  {
    slug: "fanfueled-mobile",
    title: "FanFueled Mobile",
    context: "FanFueled · 2014",
    description:
      "Mobile web app for FanFueled event pages and mobile checkout flow.",
    href: "/archive/fanfueled-mobile",
    archived: true,
  },
  {
    slug: "fanfueled-engage",
    title: "FanFueled Engage",
    context: "FanFueled · 2013",
    description:
      "Social e-commerce platform with brand and profile pages, mobile and tablet UI.",
    href: "/archive/fanfueled-engage",
    archived: true,
  },
  {
    slug: "fanfueled-home",
    title: "Cows & Bulls",
    context: "FanFueled · 2013",
    description: "Social engagement game with peer-to-peer mechanics.",
    href: "/archive/fanfueled-home-page",
    archived: true,
  },
];
