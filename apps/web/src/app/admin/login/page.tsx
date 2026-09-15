import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminLoginPageClient } from "./admin-login-page-client";

export const metadata: Metadata = {
  title: "ورود",
};

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginPageClient />
    </Suspense>
  );
}
