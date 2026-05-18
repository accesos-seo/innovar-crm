import React from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { Footer } from "./Footer";
import { useUIStore } from "@/store/uiStore";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

/**
 * Authenticated app shell: sidebar + topbar + content + footer.
 * Auth guarding lives in <ProtectedRoute>, not here.
 */
export function Layout({ children }: LayoutProps) {
  const { isSidebarCollapsed } = useUIStore();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main 
        className={cn(
          "flex-1 min-h-screen relative overflow-x-hidden flex flex-col transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "ml-20" : "ml-64"
        )}
      >
        <TopBar />
        <div className="pt-24 px-8 pb-12 relative z-10 flex-1">
          {children}
        </div>
        <Footer />
      </main>
    </div>
  );
}
