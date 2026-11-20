import { db } from "@/db";
import { uploads } from "@/db/schema";
import {
  can,
  currentUser,
  checkOrigin,
  errorResponse,
  fail,
} from "@/lib/server";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const form = await request.formData();
    const page = String(form.get("page") || "products");
    if (!["products", "categories", "stock", "settings"].includes(page))
      fail("Destination invalide.");
    const user = await currentUser();
    if (!user) fail("Connectez-vous pour continuer.", 401);
    if (!can(user, page, "create") && !can(user, page, "edit"))
      fail("Vous ne disposez pas de cette autorisation.", 403);
    const file = form.get("file");
    if (!(file instanceof File)) fail("Choisissez une image.");
    if (file.size > 5 * 1024 * 1024) fail("L’image doit faire moins de 5 Mo.");
    const buffer = Buffer.from(await file.arrayBuffer());
    const isPng = buffer
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const isJpg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
    const isWebp =
      buffer.subarray(0, 4).toString() === "RIFF" &&
      buffer.subarray(8, 12).toString() === "WEBP";
    if (!isPng && !isJpg && !isWebp)
      fail("Formats acceptés : PNG, JPG et WebP.");
    const id = crypto.randomUUID();
    await db
      .insert(uploads)
      .values({
        id,
        name: file.name.slice(0, 200),
        mime: isPng ? "image/png" : isJpg ? "image/jpeg" : "image/webp",
        content: buffer.toString("base64"),
      });
    return Response.json({ url: `/api/uploads/${id}` });
  } catch (e) {
    return errorResponse(e);
  }
}
