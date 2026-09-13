import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import styles from "./ui-system.module.css";

type CardSize = "primary" | "secondary" | "half" | "full";
type ButtonVariant = "primary" | "secondary";

const cardSizeClass: Record<CardSize, string> = {
  primary: styles.cardPrimary,
  secondary: styles.cardSecondary,
  half: styles.cardHalf,
  full: styles.cardFull,
};

export function NavixaGrid({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`${styles.grid} ${className}`.trim()} {...props} />;
}

export function NavixaCard({
  size = "full",
  className = "",
  ...props
}: HTMLAttributes<HTMLElement> & { size?: CardSize }) {
  return <section className={`${styles.card} ${cardSizeClass[size]} ${className}`.trim()} {...props} />;
}

export function NavixaButton({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variantClass = variant === "primary" ? styles.primaryButton : styles.secondaryButton;
  return <button type={type} className={`${variantClass} ${className}`.trim()} {...props} />;
}

export function NavixaIconButton({
  label,
  children,
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      type={type}
      className={`${styles.iconButton} ${className}`.trim()}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}
