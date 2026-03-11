"use client";

import { useEffect, useState } from "react";

export interface Server {
  id: string;
  name: string;
}

export function useServers() {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState("");

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/servers");
      const data: Server[] = await res.json();
      setServers(data);
      if (data.length > 0) setSelectedServer(data[0].id);
    };
    void load();
  }, []);

  return { servers, selectedServer, setSelectedServer };
}
