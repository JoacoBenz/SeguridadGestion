// Ruta TEMPORAL para verificar la integración con Sentry en producción.
// Tira un error controlado que onRequestError debe capturar y mandar a Sentry.
// Protegida con el CRON_SECRET para que nadie pueda generar ruido a voluntad.
// BORRAR después de confirmar que el evento llegó al dashboard.

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) {
    return new Response(null, { status: 404 });
  }
  throw new Error(`SENTRY_TEST ${new Date().toISOString()}`);
}
