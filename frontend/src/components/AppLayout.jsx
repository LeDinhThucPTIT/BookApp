import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Footer from './Footer'
import Sidebar from './Sidebar'
import Topbar from './Topbar'

export default function AppLayout({ active, footerVariant = 'home', showTopbar = true }) {
  const [search, setSearch] = useState('')

  return (
    <div className={`Body ${active === 'Stories' ? 'stories-layout' : ''}`}>
      <Sidebar active={active} />
      {showTopbar ? <Topbar search={search} onSearchChange={setSearch} /> : null}
      <div className="Content-right">
        <Outlet context={{ search }} />
        <Footer variant={footerVariant} />
      </div>
    </div>
  )
}
