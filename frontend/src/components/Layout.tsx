import type { ReactNode } from "react";
import { Navbar } from "./Navbar";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs text-slate-500">
          <p>
            WaterWatch SA is an independent community reporting tool. It is <strong>not</strong> an official municipal
            or emergency service, and community reports are not proof of water contamination or safety. Report faults
            to your municipality too, and call <strong>10177</strong> or <strong>112</strong> in an emergency.
          </p>
        </div>
      </footer>
    </div>
  );
}
