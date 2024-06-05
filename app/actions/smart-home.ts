'use server'
import { getAsJson } from "@/app/util/util";
import { NextResponse } from "next/server";
import { kasaApiUrl } from "../constants";

export const getInfo =  async () => {
  const jsonWrap = fetch('/api/smart/switch/info')
    .then(getAsJson);
    //  => {
      // if (jsonWrap?.data) {
        // const data = jsonWrap.data;
        // setDeviceName(data.sysInfo?.alias);
        // setInfo(data)
      // }
    // });
  return jsonWrap
}

export const postToggle = async (state: string) => {
  try {
    const result = await fetch(`${kasaApiUrl}/192.168.1.73/${state}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    }).then(getAsJson);
    console.log(result);
    return NextResponse.json({ data: result })
  } catch (e) {
    console.error(e);
  }
  console.log("returning null")
  return null;

}