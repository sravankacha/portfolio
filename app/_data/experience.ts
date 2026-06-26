export type Role = {
  company: string;
  title: string;
  period: string;
  summary?: string;
  highlights: { heading: string; description: string; bullets?: string[] }[];
};

export const experience: Role[] = [
  {
    company: "Meta",
    title: "Staff Software Engineer",
    period: "Current",
    highlights: [
      {
        heading: "Risk & Compliance Tools & Automation",
        description:
          "Building tools and automation that help risk and compliance teams operate at Meta's scale — turning regulatory and policy requirements into reliable, repeatable software.",
      },
    ],
  },
  {
    company: "EAB",
    title: "Principal Front-end Engineer, Manager",
    period: "Jan 2020 – Aug 2021",
    highlights: [
      {
        heading: "Frontend engineering leadership",
        description:
          "Continued the work below as a people manager and technical lead — owning roadmap, design-system standards, and accessibility compliance across product teams.",
      },
    ],
  },
  {
    company: "EAB",
    title: "Principal Front-end Engineer",
    period: "Sep 2017 – Jan 2020",
    summary:
      "Washington DC–Baltimore Area",
    highlights: [
      {
        heading: "Accessibility & WCAG 2.1 Compliance",
        description:
          "Led development effort across multiple product teams to meet WCAG 2.1 compliance.",
        bullets: [
          "Manual and automated audits across multiple products",
          "Prioritized remediation plans and mitigation patterns",
          "Updated the component library and implementation guidelines",
          "Reviewed solutions and code from developers against best practices",
          "Contributed accessibility patterns to design system documentation",
        ],
      },
      {
        heading: "Enterprise Design System & UI Component Library",
        description:
          "Built a unified enterprise design system for products within EAB. Developed UI components based on Web Components to enable support across multiple front-end frameworks and libraries.",
        bullets: [
          "Design tokens and patterns aligned with EAB brand + accessibility",
          "Component library on Web Components for framework portability",
          "Per-component accessibility and performance audits",
          "Authored in TypeScript",
        ],
      },
      {
        heading: "Application Framework",
        description:
          "Built application framework with common service modules and prefabricated solutions to rapidly bootstrap frontend applications.",
        bullets: [
          "App-level components for navigation, workflows, forms, datatables, page patterns",
          "Application services for auth, routing, tracking, logging, caching, network, error handling",
          "Tooling/CLI to bootstrap and build applications with webpack & rollup",
          "Unit and e2e test support with Chai, Mocha & Cypress",
          "CI for builds, tests, audits, and deployments",
        ],
      },
      {
        heading: "Configurable Course Catalog Search",
        description:
          "Built a highly configurable interface with advanced filters to search course catalogs across multiple parameters.",
        bullets: [
          "Metadata contract to render dynamic form fields with hints and labels",
          "Transformed elastic search metadata into rich form-field metadata",
          "Tabular and card result formats with configurable data points",
          "Runtime-constructed interface configurable per school",
        ],
      },
    ],
  },
  {
    company: "The Advisory Board Company",
    title: "Senior Front End Engineer",
    period: "Nov 2015 – Sep 2017",
    summary: "Washington DC–Baltimore Area",
    highlights: [
      {
        heading: "Lead UI development on multiple product features",
        description:
          "Led UI development efforts on multiple product features — academic planning, scheduling, the Navigate/Guide mobile app, the rapid-application framework, and Navigate's WCAG 2.0 compliance work.",
      },
      {
        heading: "WCAG 2.0 Compliance for Navigate",
        description:
          "Brought a complex Angular SPA to WCAG 2.0 compliance.",
        bullets: [
          "Updated Angular components and interactions for accessibility",
          "Built accessible alternatives to complex visualizations",
          "Updated colors, navigation, ARIA attributes, and labels",
          "Validated solutions with screen readers",
        ],
      },
      {
        heading: "Academic Planning Solutions",
        description:
          "Collaborative academic planning solution for students and advisors.",
        bullets: [
          "Intuitive multi-term planning interface from the course catalog",
          "Led a team of frontend engineers against tight deadlines",
          "Architected for packaging, configuration, and deployment across products",
          "Version management for collaborative student/advisor workflows",
          "Real-time updates via WebSockets",
        ],
      },
      {
        heading: "Class Scheduling & Registration",
        description:
          "Course/section scheduling and registration system integrated with institutions.",
        bullets: [
          "Calendar-based scheduling with real-time section availability",
          "Accessible alternatives to drag-and-drop and calendar interactions",
          "Client-side rules engine to guide students toward valid schedules",
        ],
      },
      {
        heading: "Navigate/Guide Mobile App",
        description:
          "Bootstrapped and delivered the company's first mobile app.",
        bullets: [
          "Mobile app on Angular/Ionic/Cordova",
          "Group messaging, task management, appointment scheduling",
          "Auth integration across multiple school systems",
          "Offline experience, caching, push notifications, native calendar integration",
          "Build, optimization, signing, and app-store submission pipelines",
        ],
      },
    ],
  },
  {
    company: "The Advisory Board Company",
    title: "Front End Engineer",
    period: "Aug 2014 – Nov 2015",
    summary: "Washington D.C. Metro Area",
    highlights: [
      {
        heading: "Rapid Application Framework",
        description:
          "Built a common UI framework to accelerate development across multiple product teams — the foundation that later evolved into the design system and micro-frontend services at EAB.",
        bullets: [
          "Application services for networking, routing, logging, tracking",
          "Reusable accessible components for rapid page composition",
          "Standard tooling for builds, tests, and deploys",
          "AngularJS as the core SPA stack",
        ],
      },
    ],
  },
  {
    company: "FanFueled",
    title: "UX/UI Designer & Front-End Developer",
    period: "Jun 2012 – Aug 2014",
    summary:
      "Greater Chicago Area. FanFueled was an engagement marketing company building social gaming solutions for brands, artists, and festivals. We used patented software to track the ripple of influence, incentivizing peer-to-peer marketing.",
    highlights: [
      {
        heading: "Platinum Nights",
        description:
          "Fan engagement platform for the launch of Bud Light Blue & Michelob Ultra.",
        bullets: [
          "Frontend client for the Platinum Nights engagement experience",
          "Facebook/Twitter SDK integration for friend graph and sharing",
          "Responsive web app, optimized for gaming performance",
        ],
      },
      {
        heading: "FanFueled Engage",
        description:
          "Social e-commerce platform and brand/profile pages.",
        bullets: [
          "Designed mobile and tablet UI mockups for brand and profile pages",
          "Redesigned and built the DIY brand-page wizard",
          "Plugins, responsive pages, page-load optimizations across multiple CDNs",
          "Dashboards to track engagement and troubleshoot issues",
        ],
      },
      {
        heading: "FanFueled Event Ticketing",
        description:
          "Ticketing platform for artists, brands, and clubs in the Mid-west region.",
        bullets: [
          "New UI for ticket purchase and checkout",
          "Online tickets, order-confirmation emails, multi-device + print layouts",
          "FanFueled Box-Office web app for kiosks",
          "Heuristic and competitive analysis, user testing",
          "Embeddable ticket-purchase widget",
        ],
      },
    ],
  },
  {
    company: "FanFueled",
    title: "UI Designer Intern",
    period: "Jan 2012 – Jun 2012",
    summary: "Greater Chicago Area",
    highlights: [
      {
        heading: "Fan engagement platform — ideation & concept",
        description:
          "Worked with the creative director to ideate and conceptualize the fan engagement platform — early UI concepts, brand exploration, and mockups for what became FanFueled Engage.",
      },
    ],
  },
  {
    company: "OISS, DePaul University",
    title: "User Experience & Content Developer",
    period: "Earlier",
    highlights: [
      {
        heading: "Office of International Student Success",
        description:
          "Design, website maintenance, and content for the student success team.",
        bullets: [
          "Designed UI for the office's student check-in touchscreen application",
          "Sitemaps, surveys, and card-sorting for an information architecture refresh",
          "Educational video tutorials, fliers, handouts, and information booklets",
        ],
      },
    ],
  },
  {
    company: "VeriSign — Mobile Media Division",
    title: "Web Developer Intern",
    period: "Earlier",
    highlights: [
      {
        heading: "PictureMail Reports Dashboard",
        description:
          "Reporting dashboards for error rates, server performance, server logs, and response metrics.",
        bullets: [
          "Web-based monitoring and reporting for PictureMail and MMS platforms",
          "Object-oriented architecture in Java and Perl",
          "Database design to store and serve millions of data points",
          "Java applets for visualizing server performance data",
        ],
      },
    ],
  },
  {
    company: "Association of Computer Science, BITS-Pilani",
    title: "Designer",
    period: "Earlier",
    highlights: [
      {
        heading: "Association branding & web presence",
        description:
          "Designed and developed the association's website and visual identity.",
        bullets: [
          "Logo, certificates, fliers, invitations, and t-shirts for the association",
        ],
      },
    ],
  },
];
