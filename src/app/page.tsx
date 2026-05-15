import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function Home() {
  const user = await db.user.findUnique({ where: { id: 1 } });
  if (user) redirect("/dashboard");
  redirect("/onboarding");
}
