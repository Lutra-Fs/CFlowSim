/* eslint-disable import/default */
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'

if (process.env.NODE_ENV === 'development') {
  // use axe for accessibility testing
  const axe = import('@axe-core/react')
  void axe.then(axe => {
    void axe.default(React, ReactDOM, 1000)
  })
}
// eslint-disable-next-line import/no-named-as-default-member
const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Failed to find the root element')
}
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
