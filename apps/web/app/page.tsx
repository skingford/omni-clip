import Navigation from '@/components/layout/Navigation';
import Footer from '@/components/layout/Footer';
import VideoResolverClient from '@/components/hero/VideoResolverClient';

export default function Home() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Navigation />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <VideoResolverClient />
      </main>
      <Footer />
    </div>
  );
}
