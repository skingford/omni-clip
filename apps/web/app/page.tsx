import AppShell from '@/components/layout/AppShell';
import Footer from '@/components/layout/Footer';

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppShell />
      <Footer />
    </div>
  );
}
