import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-zinc-900 text-white shadow-2xs",
        secondary:
          "border-zinc-200/60 bg-zinc-100 text-zinc-700",
        destructive:
          "border-rose-200/60 bg-rose-50 text-rose-700",
        outline:
          "border-zinc-200 bg-white text-zinc-700",
        success:
          "border-emerald-200/60 bg-emerald-50 text-emerald-700",
        warning:
          "border-amber-200/60 bg-amber-50 text-amber-700",
        discount:
          "border-blue-500/20 bg-blue-500/10 text-blue-600 font-bold",
        pro:
          "border-blue-500/20 bg-blue-500/10 text-blue-600 font-bold uppercase tracking-wider text-[10px]",
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
