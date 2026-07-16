import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLayout } from '@/components/common/AppLayout';
import { PptMakerPage } from '@/pages/pptMaker/PptMakerPage';

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/ppt-maker" element={<PptMakerPage />} />
        <Route path="*" element={<Navigate to="/ppt-maker" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </AppLayout>
  );
}
