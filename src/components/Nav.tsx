"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const pathname = usePathname();

  return (
    <nav className="top-nav">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-[1.9rem] font-semibold tracking-[-0.08em] text-[#101311]">
            uBlend Stock
          </Link>
          <span className="data-chip data-chip-accent hidden sm:inline-flex">Inventory CRM</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-full border border-[rgba(16,19,17,0.08)] bg-white/60 p-1.5 shadow-sm">
          {links.map((link) => {
            const active = pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={[
                  "rounded-full px-4 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em]",
                  active
                    ? "bg-[#101311] text-white"
                    : "text-[rgba(16,19,17,0.72)] hover:bg-[#101311] hover:text-white",
                ].join(" ")}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
