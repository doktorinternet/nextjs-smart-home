'use client';
import TimeTable from "@/components/TimeTable";
import GridSection from "@/components/GridSection";
import { useContext, useEffect } from "react";
import { cancelTouchEvents } from "@/code/Util";
import GridProvider, { GridContext } from "@/components/providers/GridProvider";
import WebPlayer from "@/components/WebPlayer";

// `app/dashboard/page.tsx` is the UI for the `/dashboard` URL
export default function Page() {

  useEffect(() => {
    cancelTouchEvents();
  });

  const getModules = () => {

    return (<>

      <GridSection yPartitions={1 / 2} xPartitions={1}>
        <TimeTable />
      </GridSection>

      {/* performance issues and wonky css on safari 10.3.4 */}
      {/* crashes on chrome */}
      {/* <GridSection yPartitions={1 / 4} xPartitions={1}>
        <WebPlayer />
      </GridSection> */}

      {/* <GridSection> Test section </GridSection> */}

    </>);
  }

  return (
    <GridProvider>
      {getModules()}
    </GridProvider>
  )
}
