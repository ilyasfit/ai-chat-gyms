"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

interface ThemeAwareLogoProps {
  width?: number;
  height?: number;
  className?: string;
}

export function ThemeAwareLogo({
  width = 100,
  height = 50,
  className,
}: ThemeAwareLogoProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Return a placeholder or null to avoid hydration mismatch
    // You can also return a generic logo or a loading state
    return <div style={{ width, height }} className={className} />;
  }

  const currentTheme = theme === "system" ? resolvedTheme : theme;
  const logoSrc = currentTheme === "dark" ? "/myo-dark.svg" : "/myo-light.svg";

  return (
    <Image
      src={logoSrc}
      alt="Myo Logo"
      width={width}
      height={height}
      className={className}
    />
  );
}
