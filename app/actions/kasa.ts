import { NextApiRequest, NextApiResponse } from "next";
import { postApi } from "../api/Util";

export const kasaApiUrl = 'http://server01:8080';
export const localUrl = 'http://localhost:3000';


export async function postKasaDeviceOn(
  ip: string,
  req: NextApiRequest,
  res: NextApiResponse
  ) {
    return postApi(`${kasaApiUrl}/${ip}/off`, req,res);
}

export async function postKasaDeviceOff(
  ip: string,
  req: NextApiRequest,
  res: NextApiResponse
  ) {
    return postApi(`${kasaApiUrl}/${ip}/on`, req,res);
}