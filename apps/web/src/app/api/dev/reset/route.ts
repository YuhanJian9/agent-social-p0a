import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { resetDemoData } from "@/lib/domain";
import { DomainError } from "@/lib/errors";
import { authConfigured } from "@/lib/auth/server";

export function POST() {
  try {
    if (authConfigured() || process.env.NODE_ENV === "production") {
      throw new DomainError(404, "NOT_FOUND", "error.not_found");
    }
    return NextResponse.json(resetDemoData());
  } catch (error) {
    return jsonError(error);
  }
}
