import Dashboard from './dashboard';

// App-router requires a `page.js` (or page.tsx) inside the route folder.
// This file simply renders the client component moved to `dashboard.js`.
export default function Page() {
  return <Dashboard />;
}
