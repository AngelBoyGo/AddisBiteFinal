// Addis Bites — Admin dashboard bootstrap.
//
// Front-end only: every screen reads the SHARED store through window.ABApi
// (localStorage-backed, seeded once by ab-seed.js — see index.html for load
// order). There is no backend and no network call in this app.
//
// The store, state machine, permissions and ledger are the same ones the
// Operations Console and the courier/customer apps use, so an action taken here
// is the action the rest of the platform sees.
import React from 'react';
import ReactDOM from 'react-dom/client';

import './styles.css';
import './brand.css';

import { AdminApp } from './app/admin-store';

// AdminApp owns sign-in gating (AdminShell renders <AdminSignIn/> until a staff
// session exists), so the root just mounts it.
ReactDOM.createRoot(document.getElementById('root')).render(<AdminApp />);
