import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import config from "./firebase-config.json";

const app = initializeApp(config);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const ADMIN_EMAIL = "melkbany27@gmail.com";
export const CV_DOC = "Om3a9okLjSeHwGeMEWst";
