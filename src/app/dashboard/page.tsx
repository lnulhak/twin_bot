import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const user = await db.user.findUnique({ where: { id: 1 } });
  if (!user) redirect("/onboarding");
  return <DashboardClient />;
}
