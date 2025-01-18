import { useEffect, useState } from "react";


export default function TimeString({
  timestamp, seconds, shouldUpdate
}: {
  timestamp?: string, seconds: boolean, shouldUpdate?: boolean
}) {

  const [date, setDate] = useState<string>();
  const [update, setUpdate] = useState<boolean>();

  useEffect(() => {
    refreshTime(timestamp)
  }, [timestamp]);

  useEffect(() => {
    if (shouldUpdate) {
      setUpdate(true);
      refreshTime();
    }
  }, [shouldUpdate])

  const refreshTime = (timestamp?: string) => {
    let tmp = new Date(timestamp ? Date.parse(timestamp) : new Date()).toLocaleTimeString("sv-SE", { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false });
    if (!seconds) {
      setDate(tmp.replace(":00", ""));
    } else {
      setDate(tmp);
    }
    if (update) {
      console.log("refreshtime");
      setTimeout(() => {
        refreshTime();
      }, 300);
    }
  }

  return (
    <span>{date}</span>
  );
}