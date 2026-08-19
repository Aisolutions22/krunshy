import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { LanguageProvider } from "@/lib/i18n";
import { AuthProvider } from "@/lib/auth";
import { CartProvider } from "@/lib/cart";
import { MenuThemeProvider, MenuSurface } from "@/lib/menu-theme";
import { MenuSearchProvider } from "@/lib/menu-search";
import { OrderAlertsProvider, OrderAlertStack } from "@/lib/order-alerts";

import {
  useApplyBranding,
  useBrandAssets,
  settingsQueryOptions,
  settingsQueryKey,
  brandAssetsQueryOptions,
} from "@/lib/settings";
import { Toaster } from "@/components/ui/sonner";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Crunchy — Online Food Ordering & Menu" },
      {
        name: "description",
        content:
          "Browse the full Crunchy menu and order online as a guest or on a company account — fast food ordering in Arabic and English.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Krunshy" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify([
          {
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Krunshy",
            url: "https://crunchy-food.lovable.app/",
            inLanguage: ["ar", "en"],
          },
          {
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Krunshy",
            alternateName: "Crunchy",
            url: "https://crunchy-food.lovable.app/",
            logo: "https://crunchy-food.lovable.app/favicon.png",
            telephone: "01005382216",
          },
        ]),
      },
    ],
  }),
  // Brand colors are resolved on the server so the very first paint already
  // uses the restaurant's configured palette (no default-orange flash).
  loader: async ({ context }) => {
    const settings = await context.queryClient
      .ensureQueryData(settingsQueryOptions)
      .catch(() => null);
    // Resolve the branding image URLs server-side too, so the hero is painted
    // with the first HTML response instead of popping in after hydration.
    if (settings?.logo_url || settings?.hero_image_url) {
      await context.queryClient
        .ensureQueryData(brandAssetsQueryOptions([settings.logo_url, settings.hero_image_url]))
        .catch(() => null);
    }
    return { settings };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function BrandingBridge({ children }: { children: ReactNode }) {
  useApplyBranding();
  const { logo } = useBrandAssets();

  // The uploaded logo doubles as the favicon; /favicon.png stays as fallback.
  useEffect(() => {
    if (!logo || typeof document === "undefined") return;
    for (const rel of ["icon", "apple-touch-icon"]) {
      const link =
        document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`) ??
        document.head.appendChild(Object.assign(document.createElement("link"), { rel }));
      link.href = logo;
    }
  }, [logo]);

  return <>{children}</>;
}

/** Renders the animated day/night surface for customer-facing routes only (admin stays plain). */
function CustomerSurface({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/admin")) return <>{children}</>;
  return <MenuSurface>{children}</MenuSurface>;
}

function isHexColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v);
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const loaderData = Route.useLoaderData();
  const settings = loaderData?.settings ?? null;

  // Keep the client cache aligned with what the server already rendered.
  if (settings) queryClient.setQueryData(settingsQueryKey, settings);

  const brandCss = [
    isHexColor(settings?.primary_color)
      ? `--primary:${settings?.primary_color};--sidebar-primary:${settings?.primary_color};`
      : "",
    isHexColor(settings?.accent_color) ? `--brand-accent:${settings?.accent_color};` : "",
  ].join("");

  return (
    <QueryClientProvider client={queryClient}>
      {brandCss ? (
        <style
          data-brand-bootstrap=""
          dangerouslySetInnerHTML={{ __html: `:root,.dark{${brandCss}}` }}
        />
      ) : null}
      <LanguageProvider>
        <AuthProvider>
          <CartProvider>
            <MenuThemeProvider>
              <BrandingBridge>
              <MenuSearchProvider>
              <OrderAlertsProvider>
              <CustomerSurface>
                {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
                <Outlet />
              </CustomerSurface>
              <GlobalOrderAlerts />
              </OrderAlertsProvider>
              </MenuSearchProvider>
              <Toaster richColors closeButton position="top-center" />
              </BrandingBridge>
            </MenuThemeProvider>
          </CartProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}


/** Alert toasts outside the admin area (the admin layout renders its own stack). */
function GlobalOrderAlerts() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname.startsWith("/admin")) return null;
  return <OrderAlertStack />;
}


