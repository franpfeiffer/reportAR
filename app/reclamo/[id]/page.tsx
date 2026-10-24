type Props = { params: Promise<{ id: string }> };

export const instant = false;

export default async function ComplaintPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12 sm:px-10">
      <a href="/" className="text-sm font-semibold text-indigo-700">← Volver a ReportAR</a>
      <h1 className="mt-10 text-4xl font-semibold tracking-tight text-zinc-950">Seguimiento del reclamo</h1>
      <p className="mt-4 text-zinc-600">Identificador: <span className="font-mono text-zinc-900">{id}</span></p>
      <p className="mt-2 text-sm text-zinc-500">La consulta ciudadana es pública.</p>
    </main>
  );
}
