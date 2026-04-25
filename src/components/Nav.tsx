"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/production", label: "Production" },
  { href: "/deliveries", label: "Deliveries" },
  { href: "/stock-checks", label: "Stock checks" },
  { href: "/fuel", label: "Fuel log" },
  { href: "/branches", label: "Branches" },
  { href: "/flavours", label: "Flavours" },
  { href: "/reports", label: "Reports" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="top-nav">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-[1.9rem] font-semibold tracking-[-0.08em] text-[#101311]">
            uBlend Stock
          </Link>
          <span className="data-chip data-chip-accent hidden md:inline-flex">Inventory CRM</span>
        </div>

        <div className="no-scrollbar -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 sm:mx-0 sm:w-auto sm:px-0">
          <div className="flex min-w-max items-center gap-2 rounded-full border border-[rgba(16,19,17,0.08)] bg-white/60 p-1.5 shadow-sm">
            {links.map((link) => {
              const active = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "rounded-full px-3 py-2 text-[0.69rem] font-semibold uppercase tracking-[0.14em] sm:px-4 sm:text-[0.72rem]",
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
      </div>
    </nav>
  );
}
