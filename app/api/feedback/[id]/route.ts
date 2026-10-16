import { z } from "zod";
import { endpoint, body } from "@/lib/http";
import { uuid } from "@/lib/validation";
import { requireVisit } from "@/lib/auth";
import { validVisitTicket } from "@/lib/visit-token";
import {
  feedbackInput,
  feedbackVisit,
  submitFeedback,
} from "@/lib/feedback/service";

async function authorize(id: string, token: string) {
  if (!validVisitTicket(id, token)) await requireVisit(id);
}
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const id = uuid.parse((await params).id),
      token = new URL(request.url).searchParams.get("token") || "";
    await authorize(id, token);
    return feedbackVisit(id);
  })(request);
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return endpoint(async () => {
    const id = uuid.parse((await params).id),
      input = z
        .object({ token: z.string().max(300), feedback: feedbackInput })
        .strict()
        .parse(await body(request));
    await authorize(id, input.token);
    return submitFeedback(id, input.feedback);
  }, true)(request);
}
