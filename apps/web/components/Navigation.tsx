import styles from './Navigation.module.css';

export default function Navigation() {
  return (
    <nav className={styles.nav}>
      <span className={styles.logo}>omni-clip</span>
    </nav>
  );
}
