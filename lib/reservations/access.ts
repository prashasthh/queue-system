import { customerToken, hash, secureEqual } from "../auth";
import { reservation } from "./service";
import { AppError } from "../utils/errors";
import { validVisitTicket } from "../visit-token";
export async function customerReservation(id: string, ticket = "") {
  const row = await reservation(id),
    token = await customerToken();
  if (
    !(token && secureEqual(row.access_hash, hash(token))) &&
    !validVisitTicket(`reservation:${id}`, ticket)
  )
    throw new AppError(
      "Open this reservation on the device used to book it",
      403,
    );
  return row;
}
