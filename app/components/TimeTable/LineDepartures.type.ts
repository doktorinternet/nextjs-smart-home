import { Dir } from "fs";
import { DepartureApiResponse } from "./DepartureApiResponse.type";

export type LineDepartures = {
  journeys: Array<AppJourney>;

  line: {
    gid: string;
    name: string;
    shortName: string;
    designation: string;
    backgroundColor: string;
    foregroundColor: string;
    borderColor: string;
    transportMode: unknown; // Use 'string' or 'enum' if known
    transportSubMode: unknown; // Use 'string' or 'enum' if known
    isWheelchairAccessible: boolean;
  };

}
// Function to map and merge ApiResults by line
export function mapAndMergeByLine(apiResults: DepartureApiResponse[]): LineDepartures[] {
  const lineMap = new Map<string, LineDepartures>();

  apiResults.forEach(result => {
    const { line } = result.serviceJourney;

    // Check if we already have this line in the map
    if (!lineMap.has(line.gid)) {
      // If not, create a new LineDepartures instance for this line
      lineMap.set(line.gid, {
        journeys: [],
        line: {
          gid: line.gid,
          name: line.name,
          shortName: line.shortName,
          designation: line.designation,
          backgroundColor: line.backgroundColor,
          foregroundColor: line.foregroundColor,
          borderColor: line.borderColor,
          transportMode: line.transportMode,
          transportSubMode: line.transportSubMode,
          isWheelchairAccessible: line.isWheelchairAccessible,
        }
      });
    }

    // Push the journey details to the corresponding line's journeys array
    const lineDepartures = lineMap.get(line.gid)!;
    const destination = result.serviceJourney.directionDetails.shortDirection; 
    lineDepartures.journeys.push({
      id: result.serviceJourney.gid,
      departureTime: result.estimatedOtherwisePlannedTime,
      destination: destination,
      direction: DestinationDirections.get(destination),
      isCancelled: result.isCancelled
    }
    );
  });

  // Convert the map to an array of LineDepartures
  const result = Array.from(lineMap.values());
  return result.sort((item1,item2)=>{
    return (+item1.line.shortName) - (+item2.line.shortName);
  });
}

export type AppJourney = {
  id: string,
  destination: string,
  direction: Direction | undefined,
  departureTime: string,
  isCancelled: boolean
}

export enum Direction {
  Townwards,
  Outwards
}

export const DestinationDirections = new Map<string, Direction>;

DestinationDirections.set("Fredriksdal", Direction.Townwards)
DestinationDirections.set("Frölunda", Direction.Townwards)
DestinationDirections.set("Högsbotorp", Direction.Townwards)
DestinationDirections.set("Länsmansgården", Direction.Townwards)
DestinationDirections.set("Marklandsgatan", Direction.Townwards)
DestinationDirections.set("Tynnered", Direction.Townwards)

DestinationDirections.set("Redbergsplatsen", Direction.Outwards)
DestinationDirections.set("Angered", Direction.Outwards)
DestinationDirections.set("Kortedala", Direction.Outwards)
DestinationDirections.set("Kålltorp", Direction.Outwards)
DestinationDirections.set("Östra Sjukhuset", Direction.Outwards)
