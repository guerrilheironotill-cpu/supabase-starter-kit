import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useBlogAccess } from "@/lib/use-blog-access";

/**
 * Renders the blog only to those allowed to see it: everyone once it is public, an admin
 * while it is being reviewed (with a "SÓ ADMIN" strip), nobody otherwise.
 */
export function BlogGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { visible, denied, adminOnly } = useBlogAccess();

  useEffect(() => {
    if (denied) void navigate({ to: "/", replace: true });
  }, [denied, navigate]);

  if (!visible) return null;
  return (
    <>
      {adminOnly && (
        <div className="flex items-center justify-center gap-2 bg-amber-400 px-4 py-2 text-xs font-bold tracking-wider text-amber-950">
          <Lock className="h-3.5 w-3.5" />
          SÓ ADMIN — o blog ainda não está público
        </div>
      )}
      {children}
    </>
  );
}
