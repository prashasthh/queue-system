import { NextResponse } from "next/server";
import { uuid } from "@/lib/validation";
import { validVisitTicket } from "@/lib/visit-token";
import { AppError, errorResponse } from "@/lib/utils/errors";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = uuid.parse((await params).id);
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || "";
    if (!validVisitTicket(id, token))
      throw new AppError("This private visit link is invalid or expired", 403);
    const destination =
      url.searchParams.get("to") === "priority"
        ? `/priority/queue/${id}`
        : url.searchParams.get("to") === "queue"
          ? `/queue/${id}`
          : `/menu/${id}`;
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.cookies.set(`visit_${id}`, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("Referrer-Policy", "no-referrer");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
