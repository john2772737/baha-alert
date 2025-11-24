import Head from 'next/head';

// This is the simplest possible Next.js page component.
// It has no external dependencies, no API calls, and no complex styling.
export default function SimpleTestPage() {
  return (
    <>
      <Head>
        <title>Deployment Test</title>
      </Head>
      <div style={{
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh', 
          fontSize: '3rem', 
          fontWeight: 'bold',
          color: '#3b82f6', // A bright blue color
          backgroundColor: '#1a202c' // Dark background
      }}>
        <h1>Deployment Success! (Test UI)</h1>
      </div>
    </>
  );
}