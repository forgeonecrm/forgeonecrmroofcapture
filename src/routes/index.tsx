import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/crm/Dashboard";

export const Route = createFileRoute("/")({ component: Dashboard });
