import conf from '@/app/configuration.json'
import TimeString from '../TimeString';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons';
import { LineDepartures } from './LineDepartures.type';

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
    return mins <= 0 ? 'nu' : `om ${mins} min`; 
  }

  return (
    <div 
      className={'tram-line relative flex flex-row'} 
      style={{ 
        border: `1px solid ${departuresPerLine.line.backgroundColor}`,
        backgroundColor: `${departuresPerLine.line.backgroundColor}${conf.Style.Transparency}` 
      }}>

      <h2 className='font-sans text-8xl'>{departuresPerLine.line.shortName}</h2>
      <div
      className={'flex flex-col justify-center w-full pl-2'}>
        {departuresPerLine.journeys.map(journey=>(
          <div key={Math.random()} className='flex w-full items-center justify-between leading-none text-large'>
            <div className='flex justify-self-end'>
              <FontAwesomeIcon icon={faArrowRight} />
              <div className='cut-text pl-2'>{journey.directionDetails.shortDirection}</div> 
            </div>
            <div className='flex justify-self-end pl-2'>
              <div>{`${inMinutesFromNow(journey.estimatedOtherwisePlannedTime)}`}</div>
              <div className='pl-4'>vid</div>
              <div className='pl-4'>
                <TimeString timestamp={journey.estimatedOtherwisePlannedTime} seconds={false}/>

              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}