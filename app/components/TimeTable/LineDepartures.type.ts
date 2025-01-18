import { DepartureApiResponse } from "./DepartureApiResponse.type";

export type LineDepartures = {
  journeys: Array<{
    origin: string;
    direction: string;
    directionDetails: {
      fullDirection: string;
      shortDirection: string;
      replaces: string;
      via: string;
      isFreeService: boolean;
      isPaidService: boolean;
      isSwimmingService: boolean;
      isDirectDestinationBus: boolean;
      isFrontEntry: boolean;
      isExtraBus: boolean;
      isExtraBoat: boolean;
      isExtraTram: boolean;
      isSchoolBus: boolean;
      isExpressBus: boolean;
      fortifiesLine: string;
    };
    plannedTime: string;
    estimatedTime: string;
    estimatedOtherwisePlannedTime: string;
    isCancelled: boolean;
    isPartCancelled: boolean;
    occupancy: {
      level: 'low' | 'medium' | 'high'; // Assuming these are the possible values
      source: 'prediction' | 'actual'; // Assuming these are the possible values
    };

  }>;

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
    lineDepartures.journeys.push({
      origin: result.serviceJourney.origin,
      direction: result.serviceJourney.direction,
      directionDetails: result.serviceJourney.directionDetails,
      plannedTime: result.plannedTime,
      estimatedTime: result.estimatedTime,
      estimatedOtherwisePlannedTime: result.estimatedOtherwisePlannedTime,
      isCancelled: result.isCancelled,
      isPartCancelled: result.isPartCancelled,
      occupancy: result.occupancy
    });
  });

  // Convert the map to an array of LineDepartures
  const result = Array.from(lineMap.values());
  return result.sort((item1,item2)=>{
    return (+item1.line.shortName) - (+item2.line.shortName);
  });
}