"use client";

import {
  VscChromeMinimize,
  VscChromeMaximize,
  VscChromeClose,
  VscChromeRestore,
} from "react-icons/vsc";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import Image from "next/image";

import { UserStatus } from "../../user/UserStatus";

/**
 * WindowHeader Component
 * 
 * Ajustado para ser compatível com a definição de tipos do electron.d.ts:
 * onMaximizeChange retorna void.
 */
export function WindowHeader() {
  const pathname = usePathname();
  
  // Detecta se está no cliente de forma segura para o React
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (isClient && typeof window !== "undefined" && window.windowControls) {
      // Inicializa o estado de maximização
      window.windowControls.isMaximized().then(setIsMaximized);

      // Inscreve-se para mudanças. 
      // Como onMaximizeChange retorna void (conforme seu electron.d.ts),
      // não há uma função de limpeza retornada diretamente aqui.
      window.windowControls.onMaximizeChange((_, state) => {
        setIsMaximized(state);
      });
    }
  }, [isClient]);

  const pageName =
    pathname === "/"
      ? "Home"
      : pathname
        .split("/")
        .filter(Boolean)
        .pop()
        ?.replace(/-/g, " ") ?? "";

  // Placeholder para SSR
  if (!isClient) {
    return <div className="h-10 w-full border-b border-foreground/10 bg-background" />;
  }

  // Verifica se os controles existem (ambiente Electron)
  if (!window.windowControls) {
    return null;
  }

  return (
    <header
      className="relative top-0 left-0 z-[100] flex h-10 w-full select-none items-center justify-between border-b border-foreground/10 bg-background"
      style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
    >
      {/* left: icon */}
      <div
        className="flex items-center px-4 -ml-5"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <Image 
          src="/favicon.ico" 
          width={64} 
          height={64} 
          alt="REDE VOCÊ" 
          priority 
        />
      </div>

      {/* center: title */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 text-xs text-foreground/80">
        <span className="tracking-wide uppercase font-semibold">
          REDE VOCÊ
        </span>

        <span className="opacity-50">/</span>

        <span className="tracking-wide uppercase">
          {pageName}
        </span>
      </div>

      {/* right: switches + window controls */}
      <div
        className="flex h-full items-center"
        style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
      >
        <div className="flex items-center gap-1 px-2">
          <UserStatus />
        </div>

        <div className="ml-2 flex h-full items-center">
          <button
            onClick={() => window.windowControls.minimize()}
            className="flex h-10 w-12 items-center justify-center transition-colors hover:bg-foreground/10"
            aria-label="Minimize"
          >
            <VscChromeMinimize className="h-4 w-4" />
          </button>

          <button
            onClick={() => window.windowControls.maximize()}
            className="flex h-10 w-12 items-center justify-center transition-colors hover:bg-foreground/10"
            aria-label={isMaximized ? "Restore" : "Maximize"}
          >
            {isMaximized ? (
              <VscChromeRestore className="h-4 w-4" />
            ) : (
              <VscChromeMaximize className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={() => window.windowControls.close()}
            className="flex h-10 w-12 items-center justify-center transition-colors hover:bg-red-500 hover:text-white"
            aria-label="Close"
          >
            <VscChromeClose className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
