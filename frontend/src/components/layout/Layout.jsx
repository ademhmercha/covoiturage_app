import { useLocation, Outlet } from "react-router-dom";

import Header from "./Header";
import Footer from "./Footer";
import BottomNav from "./BottomNav";
import Toaster from "../common/Toaster";

export default function Layout() {
  const location = useLocation();

  return (
    <>
      <Header />
      <main key={location.pathname} className="page page-enter">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
      <Toaster />
    </>
  );
}
