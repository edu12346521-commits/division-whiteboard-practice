import React from "react";
import { createRoot } from "react-dom/client";
import Home from "../app/page";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./supabase-config";
import "../app/globals.css";

window.__DIVISION_SUPABASE__ = { url: SUPABASE_URL, key: SUPABASE_PUBLISHABLE_KEY };
createRoot(document.getElementById("root")!).render(<React.StrictMode><Home /></React.StrictMode>);
