import { postKasaDeviceOff } from "@/app/actions/kasa";
import { NextApiRequest, NextApiResponse } from "next";

export async function POST(
  req: NextApiRequest,
  res: NextApiResponse) {
    return postKasaDeviceOff('192.168.1.73', req,res);
}
