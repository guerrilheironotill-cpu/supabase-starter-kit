import { BLOG_PUBLIC } from "@/lib/feature-flags";
import { useIsAdmin } from "@/lib/use-is-admin";

/**
 * While the blog is being reviewed it is visible only to a signed-in admin. `visible` says
 * whether to render it; `adminOnly` is true while it is not public, to mark it as such.
 */
export function useBlogAccess() {
  const isAdmin = useIsAdmin();
  return {
    visible: BLOG_PUBLIC || isAdmin === true,
    /** Still checking the session: render nothing yet instead of redirecting. */
    checking: !BLOG_PUBLIC && isAdmin === null,
    denied: !BLOG_PUBLIC && isAdmin === false,
    adminOnly: !BLOG_PUBLIC,
  };
}
