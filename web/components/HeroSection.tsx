import styles from './HeroSection.module.css';
import UrlInput from './UrlInput';

interface HeroSectionProps {
  onSubmit: (url: string) => void;
  loading: boolean;
}

export default function HeroSection({ onSubmit, loading }: HeroSectionProps) {
  return (
    <section className={styles.hero}>
      <h1 className={`text-display-hero ${styles.title}`}>omni-clip</h1>
      <p className={styles.subtitle}>
        Paste a video link, download it instantly. No watermarks, no hassle.
      </p>
      <div className={styles.inputArea}>
        <UrlInput onSubmit={onSubmit} loading={loading} />
      </div>
    </section>
  );
}
