import { assertOrigin } from "./auth";
import { AppError, errorResponse } from "./utils/errors";
export async function readText(request: Request, limit = 16000) {
  if (Number(request.headers.get("content-length") || 0) > limit)
    throw new AppError("Request is too large", 413);
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new AppError("Request is too large", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function body(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("Expected JSON request", 415);
  const raw = await readText(request);
  try {
    return JSON.parse(raw);
  } catch {
    throw new AppError("Invalid JSON");
  }
}
export function endpoint(
  fn: (request: Request) => Promise<unknown>,
  write = false,
) {
  return async (request: Request) => {
    try {
      if (write) assertOrigin(request);
      return Response.json(await fn(request), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
