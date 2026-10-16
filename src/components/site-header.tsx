import Link from "next/link";

export function SiteHeader() {
  return (
    <header>
      <div className="mx-auto flex w-full max-w-3xl items-center px-5 py-4.5 lg:py-6">
        <Link href="/" className="font-display text-[15px] font-semibold hover:opacity-88 lg:text-lg">
          Личная CRM
        </Link>
      </div>
    </header>
  );
}
