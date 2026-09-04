import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WallLab } from "@/components/lab/wall-lab";

/** The wall lab is a development page; a deployment has no such route. */
export default function WallLabPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <Suspense>
      <WallLab />
    </Suspense>
  );
}
