import { getAsJson } from "@/code/Util";
import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch('http://server01:8080/192.168.1.73/')
  .then(getAsJson);
  if(!res) {
    throw Error('nothing found');
  }
  console.log(JSON.stringify(res));
  return NextResponse.json({ data: res });
}