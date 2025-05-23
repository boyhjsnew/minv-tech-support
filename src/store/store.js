// src/store/store.js
import { configureStore } from "@reduxjs/toolkit";
import taxCodeReducer from "./taxCodeSlice";

export const store = configureStore({
  reducer: {
    taxCode: taxCodeReducer,
  },
});
