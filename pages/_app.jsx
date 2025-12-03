// File: pages/_app.jsx
import { AuthContextProvider } from '../context/AuthContext';
// If you have global styles, import them here. If not, remove this line:
// import '../styles/globals.css'; 

function MyApp({ Component, pageProps }) {
  return (
    <AuthContextProvider>
      <Component {...pageProps} />
    </AuthContextProvider>
  );
}

export default MyApp;