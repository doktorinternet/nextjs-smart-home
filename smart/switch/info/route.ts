import { serverUrl } from "@/app/constants";
import { getAsJson } from "@/app/util/util";
import { NextResponse } from "next/server";

export async function GET(): Promise<NextResponse> {
  const res = await fetch(`${serverUrl}/192.168.1.73/`)
  .then(getAsJson);
  if(!res) {
    return NextResponse.json({error: "Something went wrong in get info"},{status:500})
  }
  console.log(JSON.stringify(res));
  return NextResponse.json({ data: res });
}