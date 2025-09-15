// Example of how to add the AirtableDemo to your app's routing

import { Routes, Route } from 'react-router-dom';
import AirtableDemo from './AirtableDemo';

// Add this route to your existing routes
function AppRoutes() {
  return (
    <Routes>
      {/* Your existing routes */}
      
      {/* Add the Airtable demo route */}
      <Route path="/airtable-demo" element={<AirtableDemo />} />
      
      {/* Your other routes */}
    </Routes>
  );
}

// Or if you want to add it to a navigation menu:
function NavigationMenu() {
  return (
    <nav>
      {/* Your existing navigation items */}
      <a href="/airtable-demo">Airtable Integration Demo</a>
    </nav>
  );
}

export { AppRoutes, NavigationMenu };