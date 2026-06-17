import { useEffect } from "react";
import { Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/common/ProtectedRoute";
import Layout from "./components/layout/Layout";
import useAuthStore from "./store/authStore";

import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import SearchPage from "./pages/SearchPage";
import TripDetailPage from "./pages/TripDetailPage";
import TripFormPage from "./pages/TripFormPage";
import MyTripsPage from "./pages/MyTripsPage";
import MyBookingsPage from "./pages/MyBookingsPage";
import MessagesPage from "./pages/MessagesPage";
import BookingDetailPage from "./pages/BookingDetailPage";
import NotificationsPage from "./pages/NotificationsPage";
import ProfilePage from "./pages/ProfilePage";
import FavoritesPage from "./pages/FavoritesPage";
import NotFoundPage from "./pages/NotFoundPage";

export default function App() {
  const init = useAuthStore((state) => state.init);

  // L'authentification repose sur des cookies httpOnly (illisibles en JS) :
  // on ne connaît l'état de session qu'en appelant /api/auth/me au démarrage.
  useEffect(() => {
    init();
  }, [init]);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="search" element={<SearchPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="trips/:tripId" element={<TripDetailPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="trips/new" element={<TripFormPage />} />
          <Route path="trips/:tripId/edit" element={<TripFormPage />} />
          <Route path="my-trips" element={<MyTripsPage />} />
          <Route path="my-bookings" element={<MyBookingsPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="bookings/:bookingId" element={<BookingDetailPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="favorites" element={<FavoritesPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
