import { postKasaDeviceOn } from "@/app/actions/kasa";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  res: NextResponse): Promise<NextResponse> {
  return postKasaDeviceOn('192.168.1.73', req, res);
}