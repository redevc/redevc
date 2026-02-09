"use client";

import { Suspense } from "react";
import { HeroUIProvider, ToastProvider } from "@heroui/react";

import { WindowHeader } from "@/components/UI/electron/WindowHeader";
import NewsNavbar from "@/components/UI/Navbar";
import Footer from "@/components/UI/Footer";
import AdBannerCarousel from "@/components/UI/AdBanner";

export function ProvidersWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeroUIProvider>
      <div className="flex flex-col h-screen w-full overflow-hidden">
        <WindowHeader />
        <Suspense fallback={null}>
          <NewsNavbar />
        </Suspense>

        <ToastProvider />

        {/* ÚNICO lugar que pode scrollar */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <AdBannerCarousel />
          {children}
          <Footer />
        </main>
      </div>
    </HeroUIProvider>
  );
}
