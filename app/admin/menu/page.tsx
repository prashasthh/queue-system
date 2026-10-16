import { MenuManager } from "@/components/admin/menu-manager";
export default function Page() {
  return (
    <>
      <p className="eyebrow text-brand">Catalogue & availability</p>
      <h1 className="serif mb-2 text-4xl">Menu manager</h1>
      <p className="mb-7 text-sm text-stone-500">
        Manage categories, dishes, combos and IST service schedules.
      </p>
      <MenuManager />
    </>
  );
}
