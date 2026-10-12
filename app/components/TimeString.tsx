import { useEffect, useState } from "react";
import { locale } from "@/app/copy";


export default function TimeString({
  timestamp, seconds, shouldUpdate
}: {
  timestamp?: string, seconds: boolean, shouldUpdate?: boolean
}) {

  const [date, setDate] = useState<string>();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const refreshTime = () => {
      const currentDate = new Date(timestamp ? Date.parse(timestamp) : new Date());
      const formattedTime = currentDate.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false,
      });
      setDate(seconds ? formattedTime : formattedTime.replace(":00", ""));

      if (shouldUpdate) {
        timeout = setTimeout(refreshTime, 300);
      }
    };

    refreshTime();
    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [seconds, shouldUpdate, timestamp]);

  return (
    <span>{date}</span>
  );
}