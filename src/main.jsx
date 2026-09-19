import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { CoursesProvider } from './data/CoursesContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <CoursesProvider>
        <App />
      </CoursesProvider>
    </BrowserRouter>
  </React.StrictMode>
);
