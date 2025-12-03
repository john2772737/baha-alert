// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCCbezGFx-tvaislfIIHPbvTbZgPzabWMI",
  authDomain: "baha-alert.firebaseapp.com",
  projectId: "baha-alert",
  storageBucket: "baha-alert.firebasestorage.app",
  messagingSenderId: "102257594100",
  appId: "1:102257594100:web:dfd16684b0510b3ad318a1",
  measurementId: "G-181XG0GK0T"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);