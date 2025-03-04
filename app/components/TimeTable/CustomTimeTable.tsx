import { useEffect, useState } from "react"
import conf from '@/app/configuration.json'
import Line from "./Line";
import { DepartureApiResponse } from "./DepartureApiResponse.type";
import { LineDepartures, mapAndMergeByLine } from "./LineDepartures.type";

export default function CustomTimeTable() {
  const [data, setData] = useState<LineDepartures[]>([]);
  const [initialLoaded, setInitialLoaded]=  useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch('api/vasttrafik/departures');
      const data = await response.json();
      console.log(data);

      setData(mapAndMergeByLine(data.results));
    
      // setData(data.results);
      if(!initialLoaded) setInitialLoaded(true);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    let interval = setInterval(fetchData, conf.API["Departures-interval"]);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={'time-table grow'} onClick={fetchData}>

      {initialLoaded ? null : <div className="items-center">Loading...</div>}

      <div className="departures">
        {data?.map((line: LineDepartures) => (
          <Line key={Math.random()} departuresPerLine={line} />
        ))}
      </div>
    </div>
  )
}