import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/crm")({
  beforeLoad: ({ location }) => {
    if (location.pathname === "/dashboard/crm") {
      throw redirect({ to: "/dashboard/crm/leads" });
    }
  },
  head: () => ({
    meta: [{ title: "CRM — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: CrmLayout,
});

function CrmLayout() {
  return <Outlet />;
}
