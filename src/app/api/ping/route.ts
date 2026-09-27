/** Is the server there? Asked by the browser to tell a saved copy of a page from a live one. */
export const dynamic = "force-dynamic";

export function GET() {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
