import type { ListParams } from "../services/api";
import type { IncidentFilters, IncidentStatus } from "../types";
import { OPEN_STATUSES } from "./constants";

export function toListParams(filters: IncidentFilters): ListParams {
  const { status, date_from, date_to, ...rest } = filters;
  return {
    ...rest,
    statuses: status === "open" ? OPEN_STATUSES : status ? [status as IncidentStatus] : undefined,
    date_from: date_from ? new Date(`${date_from}T00:00:00`).toISOString() : undefined,
    date_to: date_to ? new Date(`${date_to}T23:59:59`).toISOString() : undefined,
  };
}
