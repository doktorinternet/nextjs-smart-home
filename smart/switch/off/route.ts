import { postKasaDeviceOff } from "@/app/actions/kasa";
import { NextRequest, NextResponse } from "next/server";

export default async function POST(
  req: NextRequest,
  res: NextResponse): Promise<NextResponse> {
    return postKasaDeviceOff('192.168.1.73', req,res);
}
