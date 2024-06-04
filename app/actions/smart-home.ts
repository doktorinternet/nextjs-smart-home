'use server'
import { kasaApiUrl } from "@/app/actions/kasa";
import { getAsJson } from "@/code/Util";
import { NextResponse } from "next/server";

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