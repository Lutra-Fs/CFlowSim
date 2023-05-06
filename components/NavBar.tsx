import styles from "../styles/Navbar.module.css";
import { Button } from "antd";
import Image from "next/image";
import Link from "next/link";

export default function NavBar(): JSX.Element {
  return (
    <header className={styles.header}>
      <div>
        <Link href="/">
          <Image
            className={styles.logo}
            src="/physics.svg"
            alt="Physics in the Browser Logo"
            width={50}
            height={50}
            priority
          />
        </Link>
      </div>
      <div className={styles.description}>Physics in the Browser</div>
      <nav className={styles.nav}>
        <Link href="/#">
          <Button type="primary" className={styles.btn}>
            Simulations
          </Button>
        </Link>
        <Link href="/about">
          <Button type="primary" className={styles.btn}>
            About
          </Button>
        </Link>
        <Link href="/#">
          <Button type="primary" className={styles.theme_btn}>
            THEMEs
          </Button>
        </Link>
        <Link href="/#">
          <Button type="primary" className={styles.theme_btn}>
            Night Mode
          </Button>
        </Link>
      </nav>
    </header>
  );
}
