import * as React from "react"
import { Eye, EyeOff } from "lucide-react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  const [visible, setVisible] = React.useState(false)
  const isPassword = type === "password"
  const field = (
    <input
      type={isPassword && visible ? "text" : type}
      className={cn(
        "flex h-10 w-full rounded-md border border-slate-700/80 bg-[#0B1220] px-3 py-2 text-base text-slate-100 shadow-sm transition-colors file:mr-3 file:rounded file:border-0 file:bg-emerald-500/15 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-emerald-200 placeholder:text-slate-500 hover:border-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        isPassword && "pr-11",
        className
      )}
      ref={ref}
      {...props} />
  )
  if (!isPassword) return field
  return (
    <div className="relative">
      {field}
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-100"
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
})
Input.displayName = "Input"

export { Input }
