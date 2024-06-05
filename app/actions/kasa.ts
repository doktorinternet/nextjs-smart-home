'use server'
import { postApi } from "../api/common";
import { NextRequest, NextResponse } from "next/server";
import { kasaApiUrl } from "../constants";

export async function postKasaDeviceOn(
  ip: string,
  req: Request,
  res: Response
  ): Promise<NextResponse> {
    return postApi(`${kasaApiUrl}/${ip}/off`, req,res);
}

export async function postKasaDeviceOff(
  ip: string,
  req: Request,
  res: Response
  ): Promise<NextResponse> {
    return postApi(`${kasaApiUrl}/${ip}/on`, req,res);
}