import Menu from "@/components/Menu";
import { isAdmin } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const admin = await isAdmin();
  return (
    <>
      <Menu admin={admin} />
      <main>{children}</main>
    </>
  );
}
