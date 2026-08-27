import { AppNav } from "@/components/app-nav";

// AppNav renders null for a logged-out visitor, so keeping it in the ROOT layout meant every
// route in the app — including the marketing page and the sign-in screen — called cookies() and
// could never be statically rendered. It lives with the signed-in sections instead.
export default function SectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppNav />
      {children}
    </>
  );
}
