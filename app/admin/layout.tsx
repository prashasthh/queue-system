import { Shell } from "@/components/ui/common";
import { AdminLogin } from "@/components/admin/dashboard";
import { AdminNav } from "@/components/admin/nav";
import { adminSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session=await adminSession();
  return (
    <Shell wide>
      {session ? (
        <div className="grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
          <AdminNav role={session.role} name={session.name} />
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        <AdminLogin
          development={
            process.env.NODE_ENV !== "production" && !process.env.ADMIN_PASSWORD
          }
        />
      )}
    </Shell>
  );
}
