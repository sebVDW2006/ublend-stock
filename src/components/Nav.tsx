import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/production", label: "Production" },
  { href: "/deliveries", label: "Deliveries" },
  { href: "/stock-checks", label: "Stock checks" },
  { href: "/branches", label: "Branches" },
  { href: "/flavours", label: "Flavours" },
  { href: "/reports", label: "Reports" },
];

export function Nav() {
  return (
    <header className="bg-gradient-to-r from-brand via-purple-600 to-brand-dark text-white shadow-lg">
      <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between gap-8">
        <Link href="/" className="font-bold text-2xl tracking-tight hover:opacity-80 transition">
          📦 uBlend Stock
        </Link>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="opacity-90 hover:opacity-100 hover:scale-105 transition-transform"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
