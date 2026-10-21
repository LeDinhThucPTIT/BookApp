import { NavLink } from 'react-router-dom'

const items = [
  {
    to: '/stories',
    className: 'Stories',
    white: '/images/Logo/Stories1.svg',
    black: '/images/Logo/Stories2.svg',
    alt: 'Đọc truyện',
  },
  {
    to: '/home',
    className: 'Home',
    white: '/images/Logo/House1.png',
    black: '/images/Logo/House2.png',
    alt: 'Trang chủ',
  },
  {
    to: '/history',
    className: 'History',
    white: '/images/Logo/History1.png',
    black: '/images/Logo/History2.png',
    alt: 'Lịch sử',
  },
  {
    to: '/save',
    className: 'Save',
    white: '/images/Logo/Save1.png',
    black: '/images/Logo/Save2.png',
    alt: 'Lưu trữ',
  },
  {
    to: '/setting',
    className: 'Setting',
    white: '/images/Logo/Setting1.png',
    black: '/images/Logo/Setting2.png',
    alt: 'Cài đặt',
  },
]

export default function Sidebar({ active }) {
  return (
    <div className="Header">
      <div className="logo">
        <img src="/images/Logo/Logo.png" alt="logo" />
      </div>
      <ul className="menu">
        {items.map((item) => (
          <li
            key={item.to}
            className={`nav-link ${item.className} ${active === item.className ? 'active' : ''}`}
          >
            <NavLink to={item.to} title={item.alt} aria-label={item.alt}>
              <img src={item.white} className="icon-white" alt="" aria-hidden="true" />
              <img src={item.black} className="icon-black" alt="" aria-hidden="true" />
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
