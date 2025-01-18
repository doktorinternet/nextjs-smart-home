export type DepartureApiResponse = {
  detailsReference: string;
  serviceJourney: {
    gid: string;
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
  };
  stopPoint: {
    gid: string;
    name: string;
    platform: string;
    latitude: number;
    longitude: number;
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
}