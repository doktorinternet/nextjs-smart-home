import { getAsJson } from "@/app/util/util";
import { NextRequest, NextResponse } from "next/server";

export async function postApi(
  url: string,
  req: Request,
  res: Response): Promise<NextResponse> {
  if (req) {
    console.log(JSON.stringify(req));
    try {
      const result = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // body: req?.body
        },
      }).then(getAsJson);
      return NextResponse.json({ data: result.json() })
    } catch (e) {
      console.error(e);
    }
  }
  console.log("returning null")
  return NextResponse.json({error: 'Sometihng went wrong'}, {status: 500});
}