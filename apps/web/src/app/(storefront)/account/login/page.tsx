import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginPageClient } from "./login-page-client";

export const metadata: Metadata = {
  title: "ورود",
  robots: { index: false },
};

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageClient />
    </Suspense>
  );
}
