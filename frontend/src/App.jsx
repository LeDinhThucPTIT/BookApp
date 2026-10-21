import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import GuestRoute from './components/GuestRoute'
import ProtectedRoute from './components/ProtectedRoute'
import AdminAddBook from './pages/admin/AdminAddBook'
import AdminBooks from './pages/admin/AdminBooks'
import AdminComments from './pages/admin/AdminComments'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminLayout from './pages/admin/AdminLayout'
import AdminUsers from './pages/admin/AdminUsers'
import BookDetailPage from './pages/BookDetailPage'
import HistoryPage from './pages/HistoryPage'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import ReadBookPage from './pages/ReadBookPage'
import SavePage from './pages/SavePage'
import SettingPage from './pages/SettingPage'
import UploadPage from './pages/UploadPage'
import StoriesPage from './pages/StoriesPage'
import StoryDetailPage from './pages/StoryDetailPage'

export default function App() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout active="Stories" />}>
          <Route path="/stories" element={<StoriesPage />} />
          <Route path="/stories/:bookId" element={<StoryDetailPage />} />
        </Route>
        <Route element={<AppLayout active="Home" />}>
          <Route path="/home" element={<HomePage />} />
        </Route>
        <Route element={<AppLayout active="Home" footerVariant="detail" />}>
          <Route path="/book/:bookId" element={<BookDetailPage />} />
        </Route>
        <Route element={<AppLayout active="History" />}>
          <Route path="/history" element={<HistoryPage />} />
        </Route>
        <Route element={<AppLayout active="Save" />}>
          <Route path="/save" element={<SavePage />} />
        </Route>
        <Route element={<AppLayout active="Setting" />}>
          <Route path="/setting" element={<SettingPage />} />
        </Route>
        <Route path="/read/:bookId" element={<ReadBookPage />} />
        <Route path="/upload" element={<UploadPage />} />
      </Route>

      <Route element={<ProtectedRoute adminOnly />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="books" element={<AdminBooks />} />
          <Route path="books/add" element={<AdminAddBook />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="comments" element={<AdminComments />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
