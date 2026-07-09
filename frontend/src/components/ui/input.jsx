import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "flex h-10 w-full rounded-md border border-slate-700/80 bg-[#0B1220] px-3 py-2 text-base text-slate-100 shadow-sm transition-colors file:mr-3 file:rounded file:border-0 file:bg-emerald-500/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-200 placeholder:text-slate-500 hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"

export { Input }
