import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { proveTransferGuard } from "@/lib/domain";
import { DomainError } from "@/lib/errors";

export function POST() {
  try {
    if (process.env.NODE_ENV === "production") {
      throw new DomainError(404, "NOT_FOUND", "error.not_found");
    }
    return NextResponse.json(proveTransferGuard());
  } catch (error) {
    return jsonError(error);
  }
}
