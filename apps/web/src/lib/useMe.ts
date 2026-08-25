"use client";

import { useCallback, useEffect, useState } from "react";
import { authApi, type Me } from "@/lib/api";

async function fetchMe(): Promise<Me | null> {
  try {
    return await authApi.me();
  } catch {
    return null;
  }
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchMe().then((result) => {
      if (active) {
        setMe(result);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setMe(await fetchMe());
    setLoading(false);
  }, []);

  return { me, loading, refresh };
}
