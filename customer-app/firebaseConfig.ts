import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';
const firebaseConfig = {
  apiKey: "AIzaSyBBRt5-O1_QnhRDIBr_-suOtCswzK_V6yM",
  authDomain: "schezwan-delight.firebaseapp.com",
  projectId: "schezwan-delight",
  storageBucket: "schezwan-delight.appspot.com",
  messagingSenderId: "225040509981",
  appId: "1:225040509981:web:2da2bc83187de58ebf6af4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// This is the crucial line that exports 'db' so index.tsx can use it!
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});