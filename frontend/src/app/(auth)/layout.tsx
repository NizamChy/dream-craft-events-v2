import Image from "next/image";
import { Logo } from "@/components/brand/logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="relative hidden overflow-hidden bg-ink lg:block">
        <Image src="/images/auth.webp" alt="" fill preload sizes="(min-width: 1024px) 60vw, 0px" className="object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="max-w-md font-display text-4xl leading-tight font-bold">Every great night starts with a ticket.</p>
          <p className="mt-3 max-w-md text-white/75">Book events, plan your own celebration and manage everything from one dashboard.</p>
        </div>
      </div>
      <div className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
