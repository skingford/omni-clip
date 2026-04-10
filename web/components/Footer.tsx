import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <p className={styles.text}>
        omni-clip is for personal use only. Please respect content creators and platform terms of service.
      </p>
    </footer>
  );
}
