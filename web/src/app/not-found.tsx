import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="w-full h-full flex items-center justify-center px-6 py-16">
      <div className="max-w-md text-center space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-500">
          404
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900">Página não encontrada</h1>
        <p className="text-sm text-neutral-500">
          Não encontramos o conteúdo que você procura. Confira o endereço ou volte para a página inicial.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-neutral-900 text-white px-4 py-2 text-sm font-semibold hover:bg-neutral-800 transition"
          >
            Voltar para a Home
          </Link>
        </div>
      </div>
    </div>
  );
}
