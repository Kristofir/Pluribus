import { useMemo, useRef } from "react";
import { useQueries } from "convex/react";
import {
  getFunctionName,
  type FunctionArgs,
  type FunctionReference,
  type FunctionReturnType,
} from "convex/server";
import { convexToJson } from "convex/values";

/** Retain only the last successful subscription value, never an editable data copy.
 * Errors pause consumers without destroying mounted editors. Identity changes reset it. */
export function retainQueryValue<T>(
  previous: { key: string; value: T | undefined } | undefined,
  key: string,
  result: T | Error | undefined,
) {
  return {
    key,
    value:
      result instanceof Error || result === undefined
        ? previous?.key === key
          ? previous.value
          : undefined
        : result,
  };
}
export function useRetainedQuery<Q extends FunctionReference<"query">>(
  query: Q,
  args: FunctionArgs<Q> | "skip",
) {
  const key = `${getFunctionName(query)}:${JSON.stringify(args === "skip" ? args : convexToJson(args))}`;
  const requests = useMemo(() => {
    const requests: Parameters<typeof useQueries>[0] = {};
    if (args !== "skip") requests.value = { query, args };
    return requests;
  }, [key]);
  const result = useQueries(requests).value as
    FunctionReturnType<Q> | Error | undefined;
  const retained = useRef<{
    key: string;
    value: FunctionReturnType<Q> | undefined;
  }>(undefined);
  retained.current = retainQueryValue(retained.current, key, result);
  return { data: retained.current.value, failed: result instanceof Error };
}
