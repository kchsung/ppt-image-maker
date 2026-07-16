import { configureStore } from '@reduxjs/toolkit';
import { pptMakerReducer } from '@/features/pptMaker/pptMakerSlice';

export const store = configureStore({
  reducer: {
    pptMaker: pptMakerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
