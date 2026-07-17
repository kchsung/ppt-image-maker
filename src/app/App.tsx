import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppLayout } from '@/components/common/AppLayout';
import { PptAdminPage } from '@/pages/pptAdmin/PptAdminPage';
import { PptMakerPage } from '@/pages/pptMaker/PptMakerPage';

export function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/ppt-maker" element={<PptMakerPage />} />
        <Route path="/ppt-admin" element={<PptAdminPage />} />
        <Route path="*" element={<Navigate to="/ppt-maker" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </AppLayout>
  );
}
