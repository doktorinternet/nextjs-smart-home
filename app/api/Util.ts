import { getAsJson } from "@/code/Util";
import { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";

export async function postApi(
  url: string, 
  req: NextApiRequest,
  res: NextApiResponse) {
  try {
    const result = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        body: req?.body
      },
    }).then(getAsJson);
    return NextResponse.json({ data: result })
  } catch (e) {
    console.error(e);
  }
  console.log("returning null")
  return null;
}