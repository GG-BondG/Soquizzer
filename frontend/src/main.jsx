import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { PetProvider } from './pet/PetProvider.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <PetProvider>
        <App />
      </PetProvider>
    </BrowserRouter>
  </React.StrictMode>
);
