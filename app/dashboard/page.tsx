'use client';
import TimeTable from "@/app/components/TimeTable";
import GridSection from "@/app/components/GridSection";
import { useEffect } from "react";
import { cancelTouchEvents } from "@/app/util/util";
import GridProvider from "@/app/components/providers/GridProvider";
import TpLinkSwitch from "@/app/components/TpLinkSwitch";
import WebPlayer from "../components/WebPlayer";
import CustomTimeTable from "../components/TimeTable/CustomTimeTable";
import TimeString from "../components/TimeString";

// `app/dashboard/page.tsx` is the UI for the `/dashboard` URL
export default function Page() {

  useEffect(() => {
    // cancelTouchEvents( );
  });

  const getModules = () => {

    return (<>

      <GridProvider>

        {/* todo ideas */}
        {/* - can basically only display external content for now, not really any interactivity. limited by old ass ipad */}
        {/* - get CI up and running..? */}
        {/* - wall mount https://www.thingiverse.com/thing:2845043 */}
        {/* - cabling */}
        {/* - weather forecast https://opendata.smhi.se/apidocs/ */}
        {/* - jailbreak pad */}
        {/* - get better pad */}

        <GridSection xPartitions={1/4}
        yPartitions={1/4}>
          <TimeString seconds shouldUpdate/>
        </GridSection>
        <GridSection
          xPartitions={1}
          // yPartitions={1/4}
        >
          <CustomTimeTable/>
        </GridSection>

        {/* <GridSection
          xPartitions={1 / 4}
          yPartitions={3 / 4}
        >
          <div className="flex   justify-center items-center">
            test thin long
          </div>
        </GridSection> */}

        {/* <GridSection
          xPartitions={1}
          yPartitions={1 / 4}
        >
          <div className="flex justify-center items-center">
            test thin flat
          </div>
        </GridSection> */}



        {/* ugh, event handlers don't work well for the ipad in react... */}
        {/* <GridSection>
        <TpLinkSwitch deviceIp={'192.168.1.73'} />
      </GridSection> */}


        {/* performance issues and wonky css on safari 10.3.4 */}
        {/* crashes on chrome */}
        <GridSection xPartitions={1} // yPartitions={1/8}
          >
          <WebPlayer />
        </GridSection>
      </GridProvider>

    </>);
  }

  return (
    getModules()
  )
}
