import { Suspense } from "react";
import { HomeClient } from "./_components/home";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HomeClient />
    </Suspense>
  );
}
