import { createContext, useContext, useState } from 'react'
import { HashRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { CentreDesk } from './pages/CentreDesk'
import { DataModel } from './pages/DataModel'
import { DonorApp } from './pages/donor/DonorApp'
import { HospitalConsole } from './pages/HospitalConsole'
import { Landing } from './pages/Landing'
import { LabPortal } from './pages/LabPortal'
import { StoreProvider, useStore } from './state/store'
import { DropMark } from './ui'

interface DonorSelection {
  donorId: string
  setDonorId: (id: string) => void
}

const DonorSelectContext = createContext<DonorSelection>({ donorId: 'd-priya', setDonorId: () => {} })
export const useDonorSelection = () => useContext(DonorSelectContext)

function TopBar() {
  const { actions } = useStore()
  return (
    <header className="topbar">
      <div className="row">
        <Link to="/" className="brand" aria-label="Donor Pass home">
          <DropMark />
          <span className="brand-name">Donor Pass</span>
        </Link>
        <span className="demo-pill">Demo · sample data only</span>
      </div>
      <nav className="nav" aria-label="Sections">
        <NavLink to="/donor">Donor app</NavLink>
        <NavLink to="/hospital">Hospital</NavLink>
        <NavLink to="/centre">Blood centre</NavLink>
        <NavLink to="/lab">Lab</NavLink>
        <NavLink to="/data">Data model</NavLink>
      </nav>
      <button
        className="btn sm ghost"
        onClick={() => {
          if (confirm('Reset the demo to its sample data? Anything you added will be cleared.')) actions.reset()
        }}
      >
        Reset demo
      </button>
    </header>
  )
}

export default function App() {
  const [donorId, setDonorId] = useState('d-priya')
  return (
    <StoreProvider>
      <DonorSelectContext.Provider value={{ donorId, setDonorId }}>
        <HashRouter>
          <TopBar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/donor/*" element={<DonorApp />} />
            <Route path="/hospital" element={<HospitalConsole />} />
            <Route path="/centre" element={<CentreDesk />} />
            <Route path="/lab" element={<LabPortal />} />
            <Route path="/data" element={<DataModel />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </HashRouter>
      </DonorSelectContext.Provider>
    </StoreProvider>
  )
}
