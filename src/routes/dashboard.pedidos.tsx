import { createFileRoute } from "@tanstack/react-router";
import { AdminOrdersManager } from "@/components/admin-orders-manager";

export const Route = createFileRoute("/dashboard/pedidos")({
  head: () => ({
    meta: [{ title: "Pedidos — Dashboard" }, { name: "robots", content: "noindex" }],
  }),
  component: AdminOrdersManager,
});
