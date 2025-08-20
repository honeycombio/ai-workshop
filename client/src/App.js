import React from 'react';
import styled, { createGlobalStyle } from 'styled-components';
import ChatInterface from './components/ChatInterface';

const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
      'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background: #f8fafc;
    color: #1a202c;
  }
  
  code {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
      monospace;
  }
  
  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
  }
  
  ::-webkit-scrollbar-track {
    background: #f1f1f1;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb {
    background: #c1c1c1;
    border-radius: 4px;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    background: #a8a8a8;
  }
  
  /* Loading spinner animation */
  .spinner {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Focus styles */
  button:focus,
  input:focus,
  textarea:focus,
  select:focus {
    outline: 2px solid #667eea;
    outline-offset: 2px;
  }
  
  /* Smooth transitions */
  * {
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  }
`;

const AppContainer = styled.div`
  min-height: 100vh;
  background: #f8fafc;
`;

function App() {
  return (
    <AppContainer>
      <GlobalStyle />
      <ChatInterface />
    </AppContainer>
  );
}

export default App;
