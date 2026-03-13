import { auth } from "@/lib/auth";
import DashboardClient from "./DashboardClient";

export default async function Page() {
  const session = await auth();
  
  return <DashboardClient session={session} />;
}
