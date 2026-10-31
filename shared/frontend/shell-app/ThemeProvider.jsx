import React, { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext({
  mode: "light",
  toggleMode: () => {},
  setMode: () => {},
});

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    return localStorage.getItem("erp_theme_mode") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-erp-mode", mode);
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("erp_theme_mode", mode);
  }, [mode]);

  const toggleMode = () => {
    setModeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setMode = (newMode) => {
    if (newMode === "light" || newMode === "dark") {
      setModeState(newMode);
    }
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleMode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

