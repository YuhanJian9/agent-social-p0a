import { NextResponse } from "next/server";
import { DomainError } from "@/lib/errors";

export function jsonError(error: unknown) {
  if (error instanceof DomainError) {
    return NextResponse.json(
      {
        code: error.code,
        message_key: error.messageKey,
        ...error.extra,
      },
      { status: error.status },
    );
  }
  console.error(error);
  return NextResponse.json(
    { code: "INTERNAL", message_key: "error.generic" },
    { status: 500 },
  );
}

export async function readJson(request: Request) {
  try {
    return (await request.json()) as unknown;
  } catch {
    return null;
  }
}
