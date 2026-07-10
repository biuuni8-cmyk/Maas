"use client";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return <button className="rounded-xl border px-3 py-2" onClick={() => setTheme(dark ? "light" : "dark")}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</button>;
}
