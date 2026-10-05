"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      title={mounted ? `Beralih ke mode ${resolvedTheme === "dark" ? "terang" : "gelap"}` : "Ganti Tema"}
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
      <span className="sr-only">Ganti Tema</span>
    </Button>
  )
}
