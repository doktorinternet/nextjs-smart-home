import { useEffect, useState } from "react"
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
    let interval = setInterval(fetchData, 5000);
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