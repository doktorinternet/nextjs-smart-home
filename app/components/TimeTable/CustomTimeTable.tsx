import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import conf from "@/app/configuration.json";
import { DepartureApiResponse } from "./DepartureApiResponse.type";
import { AppJourney, Direction, LineDepartures, mapAndMergeByLine } from "./LineDepartures.type";
import { useAutoFetch } from "@/app/dashboard/useAutoFetch";

type DeparturesPayload = {
  results: DepartureApiResponse[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isDeparturesPayload(value: unknown): value is DeparturesPayload {
  if (!isRecord(value) || !Array.isArray(value.results)) return false;

  return value.results.every((result: unknown) => {
    if (!isRecord(result) || !isRecord(result.serviceJourney)) return false;

    const { line, directionDetails } = result.serviceJourney;
    return (
      typeof result.serviceJourney.gid === "string" && result.serviceJourney.gid.length > 0 &&
      isRecord(line) &&
      ["gid", "name", "shortName", "designation", "backgroundColor", "foregroundColor", "borderColor"]
        .every((field) => typeof line[field] === "string") &&
      typeof line.gid === "string" && line.gid.length > 0 &&
      typeof line.isWheelchairAccessible === "boolean" &&
      isRecord(directionDetails) &&
      typeof directionDetails.shortDirection === "string" &&
      typeof result.estimatedOtherwisePlannedTime === "string" &&
      typeof result.isCancelled === "boolean"
    );
  });
}

type ListedDeparture = {
  line: LineDepartures["line"];
  journey: AppJourney;
};

function minutesUntil(departureTime: string, now: number) {
  return Math.floor((Date.parse(departureTime) - now) / 60_000);
}

function DepartureRow({ departure, now }: { departure: ListedDeparture; now: number }) {
  const { line, journey } = departure;
  const minutes = minutesUntil(journey.departureTime, now);
  const urgency = journey.isCancelled ? "is-cancelled" : minutes <= 5 ? "is-urgent" : minutes <= 15 ? "is-soon" : "";
  const departureTime = new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", minute: "2-digit" })
    .format(new Date(journey.departureTime));
  const relativeTime = journey.isCancelled
    ? "cancelled"
    : minutes <= 0 ? "due now" : `in ${minutes} minutes`;

  return (
    <li
      className={`tram-departure-row ${urgency}`}
      aria-label={`Line ${line.shortName} to ${journey.destination}, departs at ${departureTime}, ${relativeTime}`}
    >
      <span
        className="tram-line-badge"
        style={{
          backgroundColor: line.backgroundColor,
          color: line.foregroundColor,
          borderColor: line.borderColor,
        }}
        aria-label={`Line ${line.shortName}`}
      >
        {line.shortName}
      </span>
      <span className="tram-departure-destination" title={journey.destination}>{journey.destination}</span>
      <time className="tram-departure-time" dateTime={journey.departureTime}>{departureTime}</time>
      {journey.isCancelled ? (
        <span className="tram-departure-remaining">Cancelled</span>
      ) : (
        <span className="tram-departure-remaining">
          {minutes <= 0 ? "Nu" : `${minutes} min`}
        </span>
      )}
    </li>
  );
}

type CustomTimeTableProps = {
  autoFetch: ReturnType<typeof useAutoFetch>;
  onRefreshReady: (refresh: (() => void) | null) => void;
  onFetchStateChange: (state: { loading: boolean; error: string | null }) => void;
};

export default function CustomTimeTable({ autoFetch, onRefreshReady, onFetchStateChange }: CustomTimeTableProps) {
  const [data, setData] = useState<LineDepartures[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const requestInFlight = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const departuresByDirection = useMemo(() => {
    const departures = new Map<Direction, ListedDeparture[]>([
      [Direction.Townwards, []],
      [Direction.Outwards, []],
    ]);

    for (const line of data) {
      for (const journey of line.journeys) {
        if (journey.direction === undefined) continue;
        departures.get(journey.direction)?.push({ line: line.line, journey });
      }
    }

    departures.forEach((list) => {
      list.sort((a, b) => Date.parse(a.journey.departureTime) - Date.parse(b.journey.departureTime));
    });

    return departures;
  }, [data]);

  const fetchData = useCallback(async () => {
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/vasttrafik/departures");
      if (!response.ok) {
        throw new Error("Could not load departures. Please try again.");
      }

      const payload: unknown = await response.json();
      if (!isDeparturesPayload(payload)) {
        throw new Error("The departures response was invalid. Please try again.");
      }

      setData(mapAndMergeByLine(payload.results));
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : "Could not load departures. Please try again.",
      );
    } finally {
      setHasLoaded(true);
      setLoading(false);
      requestInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!autoFetch.ready || !autoFetch.enabled) return;
    void fetchData();
    const interval = setInterval(() => void fetchData(), conf.API["Departures-interval"]);
    return () => clearInterval(interval);
  }, [autoFetch.ready, autoFetch.enabled, fetchData]);

  useEffect(() => {
    onRefreshReady(fetchData);
    return () => onRefreshReady(null);
  }, [fetchData, onRefreshReady]);

  useEffect(() => {
    onFetchStateChange({ loading, error });
  }, [error, loading, onFetchStateChange]);

  return (
    <div className="time-table grow" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3">
        <div role="status" aria-live="polite">
          {autoFetch.ready && autoFetch.enabled && !hasLoaded && loading && "Loading departures…"}
          {hasLoaded && loading && "Refreshing departures…"}
          {autoFetch.ready && !autoFetch.enabled && !loading && "Automatic updates are off."}
          {error && <span role="alert">{error}</span>}
        </div>
      </div>

      <div className="departures">
        {([
          [Direction.Townwards, "Syd/Väst"],
          [Direction.Outwards, "Nord/Öst"],
        ] as const).map(([direction, title]) => {
          const departures = departuresByDirection.get(direction) ?? [];
          return (
            <section className="tram-direction" key={direction} aria-labelledby={`tram-direction-${direction}`}>
              <h3 id={`tram-direction-${direction}`} className="tram-direction-heading">{title}</h3>
              {departures.length > 0 ? (
                <ol className="tram-departure-list">
                  {departures.map((departure) => (
                    <DepartureRow
                      key={`${departure.line.gid}-${departure.journey.id}`}
                      departure={departure}
                      now={now}
                    />
                  ))}
                </ol>
              ) : hasLoaded && !loading && !error ? (
                <p className="tram-direction-empty">No departures available.</p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
