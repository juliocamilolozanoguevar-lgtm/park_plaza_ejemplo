import { Loader2 } from "lucide-react";

const variants = {
  primary: "bg-park-green text-white hover:bg-park-dark focus-visible:ring-park-green",
  secondary: "border border-park-border bg-white text-park-black hover:bg-park-bg focus-visible:ring-park-green",
  gold: "bg-park-gold text-park-black hover:bg-amber-400 focus-visible:ring-park-gold",
  danger: "bg-park-danger text-white hover:bg-red-600 focus-visible:ring-park-danger",
  ghost: "text-park-dark hover:bg-park-green-soft focus-visible:ring-park-green"
};

const sizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm"
};

export function Button({ as: Component = "button", children, icon: Icon, loading = false, variant = "primary", size = "md", className = "", disabled, ...props }) {
  const isDisabled = disabled || loading;
  return (
    <Component
      className={`inline-flex max-w-full items-center justify-center gap-2 whitespace-normal rounded-button text-center font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={Component === "button" ? isDisabled : undefined}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" size={16} /> : Icon ? <Icon size={16} /> : null}
      {children}
    </Component>
  );
}
