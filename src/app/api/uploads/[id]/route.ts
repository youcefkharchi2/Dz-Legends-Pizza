import { db } from "@/db";
import { uploads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { errorResponse } from "@/lib/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const [file] = await db.select().from(uploads).where(eq(uploads.id, id));
    if (!file) return new Response("Image introuvable", { status: 404 });
    return new Response(Buffer.from(file.content, "base64"), {
      headers: {
        "Content-Type": file.mime,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
