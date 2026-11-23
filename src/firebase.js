import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import config from "./firebase-config.json";

const host = window.location.hostname;
const authDomain = (host === "localhost" || host === "127.0.0.1") ? "mohamedkbany.vercel.app" : host;
const app = initializeApp({ ...config, authDomain });
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const ADMIN_EMAIL = "melkbany27@gmail.com";
export const CV_DOC = "Om3a9okLjSeHwGeMEWst";
export const FB_PROJECT_ID = config.projectId;
export const FB_API_KEY = config.apiKey;
