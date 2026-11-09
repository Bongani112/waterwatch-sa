import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";

export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const callId = useRef(0);

  const run = useCallback(() => {
    const id = ++callId.current;
    setLoading(true);
    setError(null);
    fn()
      .then((result) => {
        if (id === callId.current) setData(result);
      })
      .catch((err: Error) => {
        if (id === callId.current) setError(err.message);
      })
      .finally(() => {
        if (id === callId.current) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    run();
  }, [run]);

  return { data, setData, error, loading, reload: run };
}
