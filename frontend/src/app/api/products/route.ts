import { config } from "../../../lib/config";

export const runtime = "nodejs";

/** The full catalog for the browse view (plain REST; no AI involved). */
export async function GET() {
  try {
    const r = await fetch(`${config.backendUrl}/products`, { next: { revalidate: 300 } });
    if (!r.ok) throw new Error(`Backend returned ${r.status}`);
    return Response.json(await r.json());
  } catch {
    return Response.json({ code: "catalog_unreachable", message: "Couldn't load the catalog" }, { status: 502 });
  }
}
