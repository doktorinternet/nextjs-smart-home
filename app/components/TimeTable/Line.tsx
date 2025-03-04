import conf from '@/app/configuration.json'
import TimeString from '../TimeString';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowDown, faArrowLeft, faArrowRight, faArrowUp } from '@fortawesome/free-solid-svg-icons';
import { LineDepartures, DestinationDirections, Direction, AppJourney } from './LineDepartures.type';
import { useEffect } from 'react';

export default function Line({
  departuresPerLine
  // , leavingAt, direction, color
}: {
  departuresPerLine: LineDepartures
  // id: string,leavingAt: string, direction: string, color: string
}) {

  const inMinutesFromNow = (leavingAt: string) => {
    const mins = Math.floor((
      Date.parse(leavingAt)-(new Date().getTime())
    )/1000/60);
    return mins <= 0 ? 'inom en minut' : `om ${mins} min`; 
  }

  const createDirectionSegments = (departures: LineDepartures, direction: Direction) => {
    const journeys = new Array<React.JSX.Element>;

    departures.journeys.sort(byTime)

    for (const journey of departures.journeys) {
      if (journey.direction === direction) journeys.push(
        <div className='flex flex-row'>
          <div className='pl-2'>{journey.destination}</div>
          <div className='flex pl-2'>
            <div>{`${inMinutesFromNow(journey.departureTime)}`}</div>
            <div className='pl-4'>vid</div>
            <div className='pl-4'>
              <TimeString timestamp={journey.departureTime} seconds={false} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className='flex flex-col'>
        { direction === Direction.Townwards ? 
        <FontAwesomeIcon icon={faArrowUp} /> :
        <FontAwesomeIcon icon={faArrowDown} />}
      {journeys}
    </div> 
    )
  }

  const byTime = (a: AppJourney, b: AppJourney)=> {
    return Date.parse(a.departureTime) - Date.parse(b.departureTime);
  }

  //useEffect(()=>console.log(departuresPerLine))

  return (
    <div 
      className={'tram-line relative flex flex-row'} 
      style={{ 
        border: `1px solid ${departuresPerLine.line.backgroundColor}`,
        backgroundColor: `${departuresPerLine.line.backgroundColor}${conf.Style.Transparency}` 
      }}>

      <h2 className='font-sans text-8xl'>{departuresPerLine.line.shortName}</h2>
      <div className={'flex flex-row justify-center h-full w-full pl-2'}>
        {
          createDirectionSegments(departuresPerLine, Direction.Townwards)
        }
        <div className="h-full"></div>
        {
          createDirectionSegments(departuresPerLine, Direction.Outwards)
        }
      </div>
    </div>
  );
}