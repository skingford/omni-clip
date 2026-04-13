import type { AppMode } from '@/components/layout/Navigation';
import styles from './HeroSection.module.css';
import UrlInput from './UrlInput';

interface HeroSectionProps {
  onSubmit: (url: string) => void;
  loading: boolean;
  mode: AppMode;
}

const modeConfig = {
  download: {
    subtitle: 'Download videos from YouTube, Douyin and Tencent — just paste a link.',
    placeholder: 'Paste a video link to download...',
  },
  play: {
    subtitle: 'Watch videos online from Tencent Video — paste a link to play.',
    placeholder: 'Paste a Tencent Video link to play online...',
  },
} as const;

export default function HeroSection({ onSubmit, loading, mode }: HeroSectionProps) {
  const { subtitle, placeholder } = modeConfig[mode];

  return (
    <section className={styles.hero}>
      <h1 className={`text-display-hero ${styles.title}`}>omni-clip</h1>
      <p className={styles.subtitle}>{subtitle}</p>
      <div className={styles.inputArea}>
        <UrlInput onSubmit={onSubmit} loading={loading} placeholder={placeholder} />
      </div>
    </section>
  );
}
