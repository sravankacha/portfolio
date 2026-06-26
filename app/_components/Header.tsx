import Link from "next/link";

const nav = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/lab", label: "Lab" },
];

export default function Header() {
  return (
    <header className="border-b border-border">
      <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-sm tracking-tight !text-foreground"
        >
          sravan.kacha
        </Link>
        <nav>
          <ul className="flex gap-6 text-sm">
            {nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="!text-foreground hover:!text-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
