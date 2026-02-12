"use client";

import { Suspense, useMemo } from "react";
import { HeroUIProvider, ToastProvider } from "@heroui/react";
import { usePathname } from "next/navigation";

import { WindowHeader } from "@/components/UI/electron/WindowHeader";
import NewsNavbar from "@/components/UI/Navbar";
import Footer from "@/components/UI/Footer";
import AdBannerCarousel from "@/components/UI/AdBanner";
import { Youtube } from "@/components/Youtube";
import { auth } from "./auth";
import { isAdminRole } from "@/utils/roles";
import { EditNewsProvider } from "@/lib/edit-news-context";
import { SaveBubble } from "@/components/UI/SaveBubble";

export function ProvidersWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data: session } = auth.useSession();
  const isAdmin = isAdminRole(session?.user?.role);
  const showYoutube = pathname === "/";

  const isEditPage = pathname?.startsWith("/edit/");
  const isAdminDashboard = pathname?.startsWith("/dashboard") && isAdmin;
  const showAdBanner = !(isEditPage || isAdminDashboard);
  const showFooter = !isEditPage;
  const editSlug = useMemo(() => {
    const match = pathname?.match(/^\/edit\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [pathname]);

  return (
    <HeroUIProvider>
      <div className="flex flex-col h-screen w-full overflow-hidden">
        <WindowHeader />
        <Suspense fallback={null}>
          <NewsNavbar />
        </Suspense>

        <ToastProvider />

        <main className="flex-1 overflow-y-auto overflow-x-hidden" data-scroll-container>
          {isEditPage ? (
            <EditNewsProvider slug={editSlug}>
              <div className="relative flex w-full min-h-full">
                <div className="flex-1 min-h-screen px-4 sm:px-6">
                  {showAdBanner ? <AdBannerCarousel /> : null}
                  {children}
                  {showYoutube ? <Youtube /> : null}
                  {showFooter ? <Footer /> : null}
                </div>
                <SaveBubble />
              </div>
            </EditNewsProvider>
          ) : (
            <div className="flex-1">
              {showAdBanner ? <AdBannerCarousel /> : null}
              {children}
              {showYoutube ? <Youtube /> : null}
              {showFooter ? <Footer /> : null}
            </div>
          )}
        </main>
      </div>
    </HeroUIProvider>
  );
}
