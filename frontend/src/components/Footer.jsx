export default function Footer({ variant = 'home' }) {
  const text =
    variant === 'detail'
      ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'
      : 'Reading books is like opening a door to another world. Each page takes you on a journey — through time, imagination, and emotion. Books help us learn, dream, and understand life from different perspectives. A good book isn’t just read; it’s felt.'

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-column footer-about">
          <div className="footer-logo">
            <img src="/images/Logo/Logo.png" alt="logo" />
          </div>
          <p>{text}</p>
        </div>
        <div className="footer-column">
          <h3>Services</h3>
          <ul>
            <li><a href="#">Email Marketing</a></li>
            <li><a href="#">Campaigns</a></li>
            <li><a href="#">Branding</a></li>
            <li><a href="#">Offline</a></li>
          </ul>
        </div>
        <div className="footer-column">
          <h3>About</h3>
          <ul>
            <li><a href="#">Our Story</a></li>
            <li><a href="#">Benefits</a></li>
            <li><a href="#">Team</a></li>
            <li><a href="#">Careers</a></li>
          </ul>
        </div>
        <div className="footer-column">
          <h3>Follow Us</h3>
          <ul className="footer-social">
            <li><a href="#"><i className="fab fa-facebook-f"></i> Facebook</a></li>
            <li><a href="#"><i className="fab fa-twitter"></i> Twitter</a></li>
            <li><a href="#"><i className="fab fa-instagram"></i> Instagram</a></li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
