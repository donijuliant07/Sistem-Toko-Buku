import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#0052cc] text-white shadow hover:bg-[#0041a8]",
        secondary:
          "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
        destructive:
          "border-transparent bg-[#e61c24] text-white shadow hover:bg-[#c8141b]",
        outline: "text-slate-800 border-slate-200 dark:text-slate-200 dark:border-slate-800",
        success:
          "border-transparent bg-emerald-600 text-white shadow hover:bg-emerald-700",
        warning:
          "border-transparent bg-amber-500 text-white shadow hover:bg-amber-600",
        discount:
          "border-transparent bg-[#e61c24] text-white font-bold tracking-tight shadow-sm",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
