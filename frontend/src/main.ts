import React from 'react'
import ReactDOM from 'react-dom/client'
import './style.css'
import { AppShell } from './AppShell'

const root = document.getElementById('app') as HTMLElement

ReactDOM.createRoot(root).render(
  React.createElement(
    React.StrictMode,
    null,
    React.createElement(AppShell)
  )
)
