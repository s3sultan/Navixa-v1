"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import Overlay from "./Overlay";
import styles from "./ui-system.module.css";

export type NavixaNavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  href?: string;
  active?: boolean;
  badge?: string | number;
  onSelect?: () => void;
};

type NavixaShellProps = {
  title: string;
  subtitle?: string;
  navItems: NavixaNavItem[];
  bottomItems?: NavixaNavItem[];
  brandLabel?: string;
  brandMeta?: string;
  actions?: ReactNode;
  sidebarFooter?: ReactNode;
  children: ReactNode;
};

type NavItemViewProps = {
  item: NavixaNavItem;
  compact?: boolean;
  onAfterSelect?: () => void;
};

function NavItemView({ item, compact = false, onAfterSelect }: NavItemViewProps) {
  const className = compact
    ? `${styles.bottomNavItem} ${item.active ? styles.bottomNavItemActive : ""}`
    : `${styles.navItem} ${item.active ? styles.navItemActive : ""}`;

  const content = (
    <>
      <span className={styles.navIcon} aria-hidden="true">{item.icon}</span>
      <span className={styles.navLabel}>{item.label}</span>
      {!compact && item.badge !== undefined ? <span className={styles.navBadge}>{item.badge}</span> : null}
    </>
  );

  const handleSelect = () => {
    item.onSelect?.();
    onAfterSelect?.();
  };

  if (item.href) {
    return (
      <Link
        className={className}
        href={item.href}
        aria-current={item.active ? "page" : undefined}
        onClick={handleSelect}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-current={item.active ? "page" : undefined}
      onClick={handleSelect}
    >
      {content}
    </button>
  );
}

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}

export default function NavixaShell({
  title,
  subtitle,
  navItems,
  bottomItems,
  brandLabel = "NAVIXA",
  brandMeta = "يفهم يومك",
  actions,
  sidebarFooter,
  children,
}: NavixaShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileItems = useMemo(() => (bottomItems ?? navItems).slice(0, 5), [bottomItems, navItems]);
  const bottomNavStyle = { "--nx-bottom-items": Math.max(mobileItems.length, 1) } as CSSProperties;

  return (
    <div className={styles.systemRoot}>
      <div className={styles.shell}>
        <aside className={styles.sidebar} aria-label="التنقل الرئيسي">
          <Link className={styles.brand} href="/" aria-label="NAVIXA الصفحة الرئيسية">
            <span className={styles.brandMark} aria-hidden="true">N</span>
            <span className={styles.brandText}>
              <strong>{brandLabel}</strong>
              <small>{brandMeta}</small>
            </span>
          </Link>

          <nav className={styles.sidebarNav} aria-label="أقسام NAVIXA">
            {navItems.map((item) => <NavItemView key={item.id} item={item} />)}
          </nav>

          {sidebarFooter ? <div className={styles.sidebarFooter}>{sidebarFooter}</div> : null}
        </aside>

        <main className={styles.main} id="navixa-main-content">
          <header className={styles.topbar}>
            <button
              type="button"
              className={`${styles.iconButton} ${styles.mobileMenuButton}`}
              aria-label="فتح قائمة التنقل"
              aria-expanded={mobileMenuOpen}
              aria-controls="navixa-mobile-navigation"
              onClick={() => setMobileMenuOpen(true)}
            >
              <MenuIcon />
            </button>

            <div className={styles.topbarTitle}>
              <strong>{title}</strong>
              {subtitle ? <small>{subtitle}</small> : null}
            </div>

            {actions ? <div className={styles.topbarActions}>{actions}</div> : null}
          </header>

          <div className={styles.content}>{children}</div>
        </main>
      </div>

      {mobileItems.length > 0 ? (
        <nav className={styles.bottomNav} style={bottomNavStyle} aria-label="التنقل السريع">
          {mobileItems.map((item) => <NavItemView key={item.id} item={item} compact />)}
        </nav>
      ) : null}

      <Overlay
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
        variant="drawer"
        title="التنقل"
        description="كل أقسام NAVIXA في مكان واحد."
        panelId="navixa-mobile-navigation"
      >
        <nav className={styles.sidebarNav} aria-label="قائمة NAVIXA للجوال">
          {navItems.map((item) => (
            <NavItemView key={item.id} item={item} onAfterSelect={() => setMobileMenuOpen(false)} />
          ))}
        </nav>
        {sidebarFooter ? <div className={styles.sidebarFooter}>{sidebarFooter}</div> : null}
      </Overlay>
    </div>
  );
}
