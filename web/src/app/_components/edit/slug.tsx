"use client";

import { Spinner } from "@heroui/react";

import { auth } from "@/lib/auth";
import { NewsSlugClient } from "../news/slug";

type Props = {
  slug: string;
};

export function EditSlugClient({ slug }: Props) {
  const { data: session, isPending } = auth.useSession();
  const userId = session?.user?.id as string | undefined;

  if (isPending) {
    return (
      <section className="w-full max-w-4xl mx-auto min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center px-4 text-center text-neutral-600">
        <Spinner color="warning" />
      </section>
    );
  }

  if (!userId) {
    return (
      <section className="w-full max-w-4xl mx-auto min-h-[70vh] sm:min-h-[80vh] flex items-center justify-center px-4 text-center text-neutral-600">
        Faça login para editar suas notícias.
      </section>
    );
  }

  return (
    <NewsSlugClient
      slug={slug}
      showComments={false}
      requiredAuthorId={userId}
      unauthorizedMessage="Você só pode editar notícias que você criou."
      redirectDraftToEdit={false}
    />
  );
}
