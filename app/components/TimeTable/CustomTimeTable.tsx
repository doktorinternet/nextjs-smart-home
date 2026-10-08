import { useCallback, useEffect, useRef, useState } from "react";
import conf from "@/app/configuration.json";
import Line from "./Line";
import { DepartureApiResponse } from "./DepartureApiResponse.type";
import { LineDepartures, mapAndMergeByLine } from "./LineDepartures.type";
import { AutoFetchSwitch, useAutoFetch } from "@/app/dashboard/useAutoFetch";

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
      isRecord(line) &&
      ["gid", "name", "shortName", "designation", "backgroundColor", "foregroundColor", "borderColor"]
        .every((field) => typeof line[field] === "string") &&
      typeof line.isWheelchairAccessible === "boolean" &&
      isRecord(directionDetails) &&
      typeof directionDetails.shortDirection === "string" &&
      typeof result.estimatedOtherwisePlannedTime === "string" &&
      typeof result.isCancelled === "boolean"
    );
  });
}

export default function CustomTimeTable() {
  const autoFetch = useAutoFetch("dashboard.autoFetch.tramDepartures");
  const [data, setData] = useState<LineDepartures[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestInFlight = useRef(false);

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

  return (
    <div className="time-table grow" aria-busy={loading}>
      <div className="flex items-center justify-between gap-3">
        <div role="status" aria-live="polite">
          {autoFetch.ready && autoFetch.enabled && !hasLoaded && loading && "Loading departures…"}
          {hasLoaded && loading && "Refreshing departures…"}
          {autoFetch.ready && !autoFetch.enabled && !loading && "Automatic updates are off."}
          {error && <span role="alert">{error}</span>}
        </div>
        <div className="dashboard-panel-actions">
          <AutoFetchSwitch label="tram departures" {...autoFetch} onChange={autoFetch.setEnabled} />
          <button type="button" onClick={() => void fetchData()} disabled={loading}>
            {loading ? "Refreshing…" : error ? "Try again" : "Refresh departures"}
          </button>
        </div>
      </div>

      <div className="departures">
        {hasLoaded && !loading && !error && data.length === 0 && (
          <p role="status">No departures available.</p>
        )}
        {data.map((line) => (
          <Line key={line.line.gid} departuresPerLine={line} />
        ))}
      </div>
    </div>
  );
}
