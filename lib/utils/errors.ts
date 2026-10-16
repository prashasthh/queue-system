import { ZodError } from "zod";
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return Response.json(
      { error: error.issues[0]?.message || "Invalid input" },
      { status: 400 },
    );
  if (error instanceof AppError)
    return Response.json({ error: error.message }, { status: error.status });
  console.error(
    "[request failed]",
    error instanceof Error ? error.message : "Unknown error",
  );
  return Response.json(
    { error: "We couldn’t complete that request. Please try again." },
    { status: 500 },
  );
}
