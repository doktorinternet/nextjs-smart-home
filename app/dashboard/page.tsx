'use client'
import TimeTable from "@/components/time-table";
import Section from "@/components/section";
import { useEffect } from "react";
import { cancelTouchEvents } from "@/code/Util";

// `app/dashboard/page.tsx` is the UI for the `/dashboard` URL
export default function Page() {
  const screenSpaceX = 728;
  const screenSpaceY = 1024;

  useEffect(()=>{
    cancelTouchEvents();
  });

  return (
    <div className={`
      grid-container
      grid 
      w-full 
      h-full 
      gap-8
      p-24
      place-content-stretch
      grid-cols-1 
      grid-rows-1
      `}>

      <TimeTable className="h-[1024]"></TimeTable>

      
      {/* <Section>Test section</Section> */}

    </div>
  )
}
