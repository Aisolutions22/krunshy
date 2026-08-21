import { useI18n } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { SiteHeader } from "@/components/site-header";
import { Clock } from "lucide-react";

/** True only when the admin has explicitly switched ordering off. */
export function useOrderingClosed() {
  const { data, isLoading } = useSettings();
  return { closed: !isLoading && data ? data.is_ordering_open === false : false, isLoading };
}

/** Full-page block shown instead of any customer ordering surface. */
export function OrderingClosedScreen() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="max-w-md space-y-4 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-muted text-muted-foreground">
            <Clock className="size-7" aria-hidden="true" />
          </div>
          <h1 className="whitespace-pre-line text-xl font-extrabold leading-relaxed sm:text-2xl">
            {t("orderingClosedMessage")}
          </h1>
        </div>
      </main>
    </div>
  );
}
