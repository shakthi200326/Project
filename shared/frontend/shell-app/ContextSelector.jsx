import React, { createContext, useContext, useState } from "react";

const WorkspaceContext = createContext({
  activeFacility: { id: "fac_main_01", name: "Main Central Warehouse", code: "WH-MAIN" },
  facilities: [],
  setActiveFacility: () => {},
});

export function WorkspaceProvider({ children }) {
  const [facilities] = useState([
    { id: "fac_main_01", name: "Main Central Warehouse", code: "WH-MAIN" },
    { id: "fac_east_02", name: "East Logistics Hub", code: "WH-EAST" },
    { id: "fac_cold_03", name: "Cold Storage Facility", code: "WH-COLD" },
  ]);

  const [activeFacility, setActiveFacility] = useState(facilities[0]);

  return (
    <WorkspaceContext.Provider value={{ activeFacility, facilities, setActiveFacility }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => useContext(WorkspaceContext);
