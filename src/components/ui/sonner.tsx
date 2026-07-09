import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="top-center"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-white/70 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border-white/40 group-[.toaster]:shadow-[0_8px_32px_rgba(0,0,0,0.08)] group-[.toaster]:rounded-2xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toast]:text-[#c40042]",
          success: "group-[.toast]:text-emerald-600",
          icon: "group-[.toast]:text-[#c40042] group-[.toast]:animate-in group-[.toast]:zoom-in-90 group-[.toast]:duration-500 group-[.toast]:slide-in-from-left-2",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
