import { createSlice } from "@reduxjs/toolkit";

const taxCodeSlice = createSlice({
  name: "taxCode",
  initialState: {
    value: null,
  },
  reducers: {
    setTaxCode: (state, action) => {
      state.value = action.payload;
    },
    clearTaxCode: (state) => {
      state.value = null;
    },
  },
});

export const { setTaxCode, clearTaxCode } = taxCodeSlice.actions;
export default taxCodeSlice.reducer;
