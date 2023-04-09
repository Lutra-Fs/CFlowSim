import Head from 'next/head'
import Image from 'next/image'
import { Inter } from 'next/font/google'
import styles from 'styles/Home.module.css'
import NavBar from "./Components/NavBar";
import {Button} from "antd";

const inter = Inter({ subsets: ['latin'] })

export default function Home() {
  return (
    <>
      <Head>
        <title>Physics in the Browser for the People</title>
        <meta name="description" content="PHYS" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
     <main>
         <div className={styles.navBar}>
             <NavBar/>
             <a href="/simDraft"><Button type="primary" className={styles.theme_btn}>[SIMULATOR TEAM USE ONLY] simulation draft</Button></a>
         </div>
     </main>
    </>
  )
}
