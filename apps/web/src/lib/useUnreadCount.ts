"use client";

import { useEffect, useState } from "react";
import { notificationApi, type Me } from "@/lib/api";

export function useUnreadCount(me: Me | null, pathname: string | null) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!me) return;
    let active = true;
    notificationApi.unreadCount().then((result) => {
      if (active) setUnread(result.count);
    });
    return () => {
      active = false;
    };
  }, [me, pathname]);

  return unread;
}
